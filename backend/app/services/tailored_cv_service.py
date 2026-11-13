import json

from sqlmodel import Session, select

from app.core.errors import BadRequestError, NotFoundError
from app.integrations.ai import AIProvider
from app.models import TailoredCv
from app.models.tables import utcnow
from app.schemas.cv import CvRead
from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent, TailoredCvRead
from app.services.application_service import ApplicationService
from app.services.cv_export import build_cv_docx, build_cv_pdf, cv_filename
from app.services.cv_tailor import profile_for_cv_prompt, tailor_cv
from app.services.documents_service import DocumentsService
from app.services.letter_checks import check_letter
from app.services.letter_export import DOCX_MEDIA_TYPE, PDF_MEDIA_TYPE
from app.services.letter_writer import job_text
from app.services.profile_service import ProfileService

NOT_SET_UP = "AI isn't set up yet. Add your Gemini key in Settings."
PROFILE_TOO_EMPTY = (
    "Fill in your profile first (your name, plus some experience, projects or a summary), "
    "so there's a CV to tailor."
)


def load_profile(session: Session) -> ProfileDetails:
    return ProfileDetails(
        **ProfileService(session).get().model_dump(include=set(ProfileDetails.model_fields))
    )


class TailoredCvService:
    def __init__(self, session: Session, ai: AIProvider | None = None):
        self.session = session
        self.ai = ai
        self.applications = ApplicationService(session)
        self.documents = DocumentsService(session)

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

    def generate(self, application_id: int) -> TailoredCvRead:
        application = self.applications.get(application_id)
        if self.ai is None:
            raise BadRequestError(NOT_SET_UP)
        profile = load_profile(self.session)
        if not profile.full_name.strip() or not (
            profile.summary.strip() or profile.experience or profile.projects
        ):
            raise BadRequestError(PROFILE_TOO_EMPTY)

        result = tailor_cv(self.ai, profile, application)  # may raise AIError
        cv = self.find(application_id) or TailoredCv(application_id=application_id)
        cv.content = result.content.model_dump()
        cv.changes = result.changes
        cv.flags = self._check(result.content, profile, application_id)
        cv.model_used = f"{self.ai.name}/{self.ai.model}"[:100]
        cv.edited = False
        cv.updated_at = utcnow() if cv.id else None
        self.session.add(cv)
        self.session.commit()
        self.session.refresh(cv)
        saved = self.documents.try_auto_save(
            self.documents.save_cv, application, result.content, profile
        )
        return self._read(cv, saved)

    def update(self, application_id: int, content: TailoredContent) -> TailoredCvRead:
        application = self.applications.get(application_id)
        cv = self.find(application_id)
        if cv is None:
            raise NotFoundError("Tailored CV for application", application_id)
        profile = load_profile(self.session)
        cv.content = content.model_dump()
        cv.flags = self._check(content, profile, application_id)
        cv.edited = True
        cv.updated_at = utcnow()
        self.session.add(cv)
        self.session.commit()
        self.session.refresh(cv)
        saved = self.documents.try_auto_save(self.documents.save_cv, application, content, profile)
        return self._read(cv, saved)

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
        if file_format == "pdf":
            data, media_type = build_cv_pdf(content, profile), PDF_MEDIA_TYPE
        else:
            data, media_type = build_cv_docx(content, profile), DOCX_MEDIA_TYPE
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
            build_cv_pdf(content, profile),
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
            build_cv_pdf(TailoredContent(**cv.content), profile),
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

    @staticmethod
    def _read(cv: TailoredCv, saved_to: str | None = None) -> TailoredCvRead:
        return TailoredCvRead(
            application_id=cv.application_id,
            content=TailoredContent(**cv.content),
            changes=cv.changes,
            flags=cv.flags,
            model_used=cv.model_used,
            edited=cv.edited,
            created_at=cv.created_at,
            updated_at=cv.updated_at,
            saved_to=saved_to,
        )
