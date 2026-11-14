import json

from sqlmodel import Session

from app.core.errors import BadRequestError, NotFoundError
from app.integrations.ai import AIProvider
from app.models import ApplicationStatus, CoverLetter
from app.models.tables import utcnow
from app.repositories.letter_repository import LetterRepository
from app.schemas.application import ApplicationUpdate
from app.schemas.letters import LetterMatch, LetterRead, LetterUpdate
from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent
from app.services.application_service import ApplicationService
from app.services.documents_service import DocumentsService
from app.services.letter_checks import check_letter
from app.services.letter_export import (
    DOCX_MEDIA_TYPE,
    PDF_MEDIA_TYPE,
    build_docx,
    build_pdf,
    letter_filename,
)
from app.services.letter_writer import job_text, profile_for_prompt, write_letter
from app.services.profile_service import ProfileService

NOT_SET_UP = "AI isn't set up yet. Choose a provider and add its key in Settings."
PROFILE_TOO_EMPTY = (
    "Fill in your profile first (at least your name, plus some experience, skills or a "
    "summary), so the letter has real facts to use."
)


def to_read(letter: CoverLetter) -> LetterRead:
    analysis = letter.analysis or {}
    return LetterRead(
        id=letter.id,
        application_id=letter.application_id,
        version=letter.version,
        tone=letter.tone,
        model_used=letter.model_used,
        content=letter.content,
        email_subject=letter.email_subject,
        email_body=letter.email_body,
        match_score=letter.match_score,
        requirements=analysis.get("requirements", []),
        matches=[LetterMatch(**m) for m in analysis.get("matches", [])],
        flags=letter.flags,
        is_selected=letter.is_selected,
        edited=letter.edited,
        created_at=letter.created_at,
        updated_at=letter.updated_at,
    )


class LetterService:
    def __init__(self, session: Session, ai: AIProvider | None = None):
        self.session = session
        self.ai = ai
        self.repo = LetterRepository(session)
        self.applications = ApplicationService(session)

    def for_application(self, application_id: int) -> list[LetterRead]:
        self.applications.get(application_id)
        return [to_read(letter) for letter in self.repo.for_application(application_id)]

    def get(self, letter_id: int) -> CoverLetter:
        letter = self.repo.get(letter_id)
        if letter is None:
            raise NotFoundError("Cover letter", letter_id)
        return letter

    def has_letters(self, application_id: int) -> bool:
        return bool(self.repo.for_application(application_id))

    def generate(
        self,
        application_id: int,
        tone: str,
        instructions: str = "",
        highlights: list[str] | None = None,
    ) -> LetterRead:
        application = self.applications.get(application_id)
        if self.ai is None:
            raise BadRequestError(NOT_SET_UP)
        profile = self._profile()
        if not profile.full_name.strip() or not (
            profile.summary.strip() or profile.skills or profile.experience or profile.projects
        ):
            raise BadRequestError(PROFILE_TOO_EMPTY)

        written = write_letter(
            self.ai,
            profile,
            application,
            tone,
            instructions,
            highlights or [],
            example=ProfileService(self.session).get().main_cover_letter,
        )  # may raise AIError

        self.repo.unselect_all(application_id)
        letter = self.repo.add(
            CoverLetter(
                application_id=application_id,
                content=written.letter,
                tone=tone,
                model_used=f"{self.ai.name}/{self.ai.model}"[:100],
                version=self.repo.next_version(application_id),
                email_subject=written.email_subject,
                email_body=written.email_body,
                match_score=written.match_score,
                analysis={"requirements": written.requirements, "matches": written.matches},
                flags=self._check(written.letter, profile, application_id),
                is_selected=True,
            )
        )
        self.session.commit()

        if application.status == ApplicationStatus.IMPORTED:
            self.applications.update(
                application_id, ApplicationUpdate(status=ApplicationStatus.DRAFTED)
            )
        self.session.refresh(letter)
        return to_read(letter)

    def update(self, letter_id: int, data: LetterUpdate) -> LetterRead:
        letter = self.get(letter_id)
        if data.content is not None and data.content != letter.content:
            letter.content = data.content.strip()
            letter.flags = self._check(letter.content, self._profile(), letter.application_id)
            letter.edited = True
        if data.email_subject is not None:
            letter.email_subject = data.email_subject.strip()
            letter.edited = True
        if data.email_body is not None:
            letter.email_body = data.email_body.strip()
            letter.edited = True
        if data.is_selected:
            self.repo.unselect_all(letter.application_id)
            letter.is_selected = True
        letter.updated_at = utcnow()
        self.session.add(letter)
        self.session.commit()
        self.session.refresh(letter)
        return to_read(letter)

    def delete(self, letter_id: int) -> None:
        letter = self.get(letter_id)
        application_id, was_selected = letter.application_id, letter.is_selected
        self.repo.delete(letter)
        self.session.flush()
        if was_selected:
            remaining = self.repo.for_application(application_id)
            if remaining:
                remaining[0].is_selected = True
        self.session.commit()

    def export(self, letter_id: int, file_format: str) -> tuple[bytes, str, str]:
        letter = self.get(letter_id)
        application = self.applications.get(letter.application_id)
        profile = self._profile()
        if file_format == "pdf":
            content, media_type = build_pdf(letter.content, profile), PDF_MEDIA_TYPE
        else:
            content, media_type = build_docx(letter.content, profile), DOCX_MEDIA_TYPE
        filename = letter_filename(application.company, application.role, file_format)
        return content, filename, media_type

    def save_documents(self, application_id: int, cvs, documents: DocumentsService) -> list[str]:
        """Saves the tailored CV and the starred letter as PDFs. Returns the files."""
        application = self.applications.get(application_id)
        profile = self._profile()
        files: list[str] = []
        tailored = cvs.find(application_id)
        letters = self.repo.for_application(application_id)
        letter = next((x for x in letters if x.is_selected), letters[0] if letters else None)
        if tailored is None and letter is None:
            raise BadRequestError("Write a cover letter or tailor your CV for this job first.")
        try:
            if tailored is not None:
                content = TailoredContent(**tailored.content)
                layout = cvs.layout(tailored.style)
                files.append(str(documents.save_cv(application, content, profile, layout)))
            if letter is not None:
                files.append(str(documents.save_letter(application, letter.content, profile)))
        except OSError as exc:
            raise BadRequestError(
                "Couldn't save the files. If one is open in another app, close it and try again."
            ) from exc
        return files

    def _profile(self) -> ProfileDetails:
        return ProfileDetails(
            **ProfileService(self.session)
            .get()
            .model_dump(include=set(ProfileDetails.model_fields))
        )

    def _check(self, text: str, profile: ProfileDetails, application_id: int) -> list[str]:
        application = self.applications.get(application_id)
        profile_text = json.dumps(profile_for_prompt(profile), ensure_ascii=False)
        return check_letter(text, profile_text=profile_text, job_text=job_text(application))
