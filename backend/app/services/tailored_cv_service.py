import json

from sqlmodel import Session, select

from app.core.errors import BadRequestError, NotFoundError
from app.integrations.ai import AIError, AIProvider
from app.models import CvDocument, TailoredCv
from app.models.tables import utcnow
from app.schemas.cv import CvRead
from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent, TailoredCvRead
from app.services.application_service import ApplicationService
from app.services.ats_check import check_cv
from app.services.cv_ai_parser import parse_cv_with_ai
from app.services.cv_export import (
    CvLayout,
    build_cv_docx,
    build_cv_pdf,
    cv_filename,
    fit_one_page,
    layout_for,
    render_cv,
)
from app.services.cv_parser import parse_cv
from app.services.cv_tailor import profile_for_cv_prompt, tailor_cv
from app.services.letter_checks import check_letter
from app.services.letter_export import DOCX_MEDIA_TYPE, PDF_MEDIA_TYPE
from app.services.letter_writer import job_text
from app.services.profile_service import ProfileService

NOT_SET_UP = "AI isn't set up yet. Add your Gemini key in Settings."
PROFILE_TOO_EMPTY = (
    "Fill in your profile first (your name, plus some experience, projects or a summary), "
    "so there's a CV to tailor."
)


# An uploaded CV read into sections, kept while the app is open: {(cv id, text length): ...}
_READ_CVS: dict[tuple[int, int], ProfileDetails] = {}
CONTACT_FIELDS = (
    "full_name", "email", "phone", "location", "linkedin_url", "github_url", "portfolio_url"
)  # fmt: skip


def load_profile(session: Session) -> ProfileDetails:
    return ProfileDetails(
        **ProfileService(session).get().model_dump(include=set(ProfileDetails.model_fields))
    )


class TailoredCvService:
    def __init__(self, session: Session, ai: AIProvider | None = None):
        self.session = session
        self.ai = ai
        self.applications = ApplicationService(session)

    def find(self, application_id: int) -> TailoredCv | None:
        return self.session.exec(
            select(TailoredCv).where(TailoredCv.application_id == application_id)
        ).first()

    def get(self, application_id: int) -> TailoredCvRead:
        self.applications.get(application_id)
        cv = self.find(application_id)
        if cv is None:
            raise NotFoundError("Tailored CV for application", application_id)
        return self._read(cv)

    # ---------- which CV, which layout ----------

    def main_cv(self) -> CvDocument | None:
        return self.session.exec(select(CvDocument).where(CvDocument.is_default)).first()

    def layout(self, style: str) -> CvLayout:
        """ "own" (or nothing chosen yet) follows the main CV; without one it's Jake's."""
        main = self.main_cv()
        return layout_for(style or "own", main.text if main else "")

    def _source(self, cv_id: int | None, profile: ProfileDetails) -> ProfileDetails:
        """What to tailor: the profile, or another uploaded CV read into the same shape."""
        main = self.main_cv()
        if cv_id is None or (main and main.id == cv_id):
            return profile
        cv = self.session.get(CvDocument, cv_id)
        if cv is None:
            raise BadRequestError("That CV isn't in Profile → Your CVs any more.")
        if not cv.text.strip():
            raise BadRequestError(
                f'CareerPilot couldn\'t read any text in "{cv.label}". Choose another CV.'
            )
        key = (cv_id, len(cv.text))
        if key not in _READ_CVS:
            try:
                _READ_CVS[key] = parse_cv_with_ai(self.ai, cv.text)[0]
            except AIError:
                _READ_CVS[key] = parse_cv(cv.text)
        read = _READ_CVS[key]
        # Contact details always come from the profile; an empty section falls back to it.
        sections = {
            name: getattr(read, name) or getattr(profile, name)
            for name in ("summary", "skills", "experience", "education", "projects")
        }
        return profile.model_copy(update=sections)

    # ---------- tailoring ----------

    def generate(
        self, application_id: int, cv_id: int | None = None, style: str | None = None
    ) -> TailoredCvRead:
        application = self.applications.get(application_id)
        if self.ai is None:
            raise BadRequestError(NOT_SET_UP)
        profile = load_profile(self.session)
        if not profile.full_name.strip() or not (
            profile.summary.strip() or profile.experience or profile.projects
        ):
            raise BadRequestError(PROFILE_TOO_EMPTY)

        source = self._source(cv_id, profile)
        result = tailor_cv(self.ai, source, application)  # may raise AIError
        cv = self.find(application_id) or TailoredCv(application_id=application_id)
        cv.style = self.layout(style or cv.style).style
        cv.source_cv_id = cv_id
        content, cuts = fit_one_page(result.content, profile, self.layout(cv.style))
        cv.content = content.model_dump()
        cv.changes = result.changes + (
            ["Trimmed the least relevant points so it fits one page"] if cuts else []
        )
        cv.flags = self._check(content, source, application_id)
        cv.model_used = f"{self.ai.name}/{self.ai.model}"[:100]
        cv.edited = False
        cv.updated_at = utcnow() if cv.id else None
        self.session.add(cv)
        self.session.commit()
        self.session.refresh(cv)
        return self._read(cv)

    def update(
        self, application_id: int, content: TailoredContent, style: str | None = None
    ) -> TailoredCvRead:
        self.applications.get(application_id)
        cv = self.find(application_id)
        if cv is None:
            raise NotFoundError("Tailored CV for application", application_id)
        profile = load_profile(self.session)
        cv.edited = cv.edited or content.model_dump() != cv.content
        cv.content = content.model_dump()
        cv.flags = self._check(content, self._source(cv.source_cv_id, profile), application_id)
        if style:
            cv.style = self.layout(style).style
        cv.updated_at = utcnow()
        self.session.add(cv)
        self.session.commit()
        self.session.refresh(cv)
        return self._read(cv)

    def delete(self, application_id: int) -> None:
        cv = self.find(application_id)
        if cv is None:
            raise NotFoundError("Tailored CV for application", application_id)
        self.session.delete(cv)
        self.session.commit()

    def export(self, application_id: int, file_format: str) -> tuple[bytes, str, str]:
        application = self.applications.get(application_id)
        cv = self.find(application_id)
        if cv is None:
            raise NotFoundError("Tailored CV for application", application_id)
        profile = load_profile(self.session)
        content = TailoredContent(**cv.content)
        layout = self.layout(cv.style)
        if file_format == "pdf":
            data, media_type = build_cv_pdf(content, profile, layout), PDF_MEDIA_TYPE
        else:
            data, media_type = build_cv_docx(content, profile, layout), DOCX_MEDIA_TYPE
        name = cv_filename(profile.full_name, file_format, application.company, application.role)
        return data, name, media_type

    def use_as_main(self, application_id: int, cvs) -> "CvRead":
        application = self.applications.get(application_id)
        cv = self.find(application_id)
        if cv is None:
            raise NotFoundError("Tailored CV for application", application_id)
        profile = load_profile(self.session)
        content = TailoredContent(**cv.content)
        text = "\n".join(
            [content.summary, ", ".join(content.skills)]
            + [f"{e.title} {e.company}\n{e.summary}" for e in content.experience]
            + [f"{p.name}\n{p.summary}" for p in content.projects]
        )
        return cvs.add_generated(
            cv_filename(profile.full_name, "pdf"),
            build_cv_pdf(content, profile, self.layout(cv.style)),
            f"Tailored for {application.company}"[:100],
            text,
        )

    def attachment(self, application_id: int) -> tuple[str, bytes, str] | None:
        """The tailored CV as a PDF for the application email, or None if there isn't one."""
        cv = self.find(application_id)
        if cv is None:
            return None
        profile = load_profile(self.session)
        return (
            cv_filename(profile.full_name, "pdf"),
            build_cv_pdf(TailoredContent(**cv.content), profile, self.layout(cv.style)),
            PDF_MEDIA_TYPE,
        )

    def _check(self, content: TailoredContent, profile: ProfileDetails, application_id: int):
        application = self.applications.get(application_id)
        text = "\n".join(
            [content.summary]
            + [e.summary for e in content.experience]
            + [p.summary for p in content.projects]
        )
        flags = check_letter(
            text,
            profile_text=json.dumps(profile_for_cv_prompt(profile), ensure_ascii=False),
            job_text=job_text(application),
        )
        return [
            flag.replace("The letter", "The CV").replace("the letter", "the CV") for flag in flags
        ]

    def _read(self, cv: TailoredCv) -> TailoredCvRead:
        content = TailoredContent(**cv.content)
        profile, layout = load_profile(self.session), self.layout(cv.style)
        # Checked every time it's tailored, edited or opened.
        ats = check_cv(content, profile, self.applications.get(cv.application_id), layout)
        return TailoredCvRead(
            application_id=cv.application_id,
            ats=ats,
            content=content,
            changes=cv.changes,
            flags=cv.flags,
            model_used=cv.model_used,
            edited=cv.edited,
            created_at=cv.created_at,
            updated_at=cv.updated_at,
            style=layout.style,
            source_cv_id=cv.source_cv_id,
            pages=render_cv(content, profile, layout)[1],
        )
