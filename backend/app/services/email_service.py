"""Approve-then-send applications: preview, queue, cancel, retry, and assisted apply."""

from datetime import timedelta
from email.message import EmailMessage
from pathlib import Path

from sqlmodel import Session, col, select

from app.core.config import Settings
from app.core.errors import BadRequestError, NotFoundError
from app.models import Application, ApplicationStatus, CvDocument, EmailLog, EmailStatus
from app.models.tables import utcnow
from app.repositories.cv_repository import CvRepository
from app.repositories.letter_repository import LetterRepository
from app.schemas.application import ApplicationUpdate
from app.schemas.email import (
    Attachment,
    BulkSendResult,
    BulkSendSkip,
    EmailLogRead,
    EmailPreview,
)
from app.services.application_service import ApplicationService
from app.services.email_builder import build_email, clean_header, new_message_id, with_signature
from app.services.email_settings_service import EmailSettingsService
from app.services.letter_export import letter_filename
from app.services.letter_service import LetterService
from app.services.tailored_cv_service import TailoredCvService

# Applications in these states haven't gone out yet, so sending moves them to "sent".
NOT_YET_SENT = {ApplicationStatus.IMPORTED, ApplicationStatus.DRAFTED, ApplicationStatus.READY}


class EmailService:
    def __init__(self, session: Session, env: Settings, cv_dir: Path):
        self.session = session
        self.env = env
        self.cv_dir = cv_dir
        self.settings_service = EmailSettingsService(session, env)
        self.applications = ApplicationService(session)
        self.letters = LetterRepository(session)

    # ---------- preview and queue ----------

    def preview(self, application_id: int) -> EmailPreview:
        application = self.applications.get(application_id)
        settings = self.settings_service.settings()
        problems = list(self.settings_service.problems(settings))
        warnings: list[str] = []

        letter = self._selected_letter(application_id)
        if letter is None:
            problems.append("Write a cover letter first.")
        if not application.contact_email:
            problems.append(
                "This job has no contact email. Use 'Assisted apply' to apply on the job's website."
            )
        cv = self._cv_for(application)
        if cv is None:
            warnings.append("No CV uploaded: the email will only include the cover letter.")
        if letter and letter.flags:
            warnings.append(f"The letter has {len(letter.flags)} thing(s) to check before sending.")
        if self._has_log(application_id, (EmailStatus.SENT,), real_only=True):
            warnings.append("You've already sent an application email for this job.")
        if self._has_log(application_id, (EmailStatus.QUEUED,)):
            problems.append("An email for this job is already waiting to be sent.")

        test_address = str(settings.test_address or settings.from_address or "")
        deliver_to = test_address if settings.test_mode else application.contact_email
        subject = letter.email_subject if letter else f"Application: {application.role}"
        if settings.test_mode:
            warnings.append(
                f"Test mode is on: this will go to {test_address or 'you'}, not the employer."
            )

        attachments = []
        if letter:
            attachments.append(Attachment(name=self._letter_filename(application)))
        tailored = TailoredCvService(self.session).attachment(application_id)
        if tailored:
            attachments.append(Attachment(name=tailored[0], size_bytes=len(tailored[1])))
        elif cv:
            attachments.append(Attachment(name=cv.original_filename, size_bytes=cv.size_bytes))

        return EmailPreview(
            to=application.contact_email,
            deliver_to=deliver_to,
            test_mode=settings.test_mode,
            subject=clean_header(subject),
            body=with_signature(letter.email_body if letter else "", settings.signature),
            attachments=attachments,
            can_send=not problems,
            problems=problems,
            warnings=warnings,
        )

    def queue(self, application_id: int) -> EmailLogRead:
        preview = self.preview(application_id)
        if not preview.can_send:
            raise BadRequestError(" ".join(preview.problems))
        settings = self.settings_service.settings()
        log = EmailLog(
            application_id=application_id,
            to_address=preview.deliver_to,
            subject=(f"[TEST] {preview.subject}" if preview.test_mode else preview.subject)[:500],
            body=preview.body,
            attachments=[a.name for a in preview.attachments],
            status=EmailStatus.QUEUED,
            kind="application",
            is_test=preview.test_mode,
            message_id=new_message_id(str(settings.from_address)),
        )
        self.session.add(log)
        self.session.commit()
        self.session.refresh(log)
        return EmailLogRead.model_validate(log)

    def queue_many(self, application_ids: list[int]) -> BulkSendResult:
        queued, skipped = 0, []
        for application_id in dict.fromkeys(application_ids):
            try:
                self.queue(application_id)
                queued += 1
            except (BadRequestError, NotFoundError) as exc:
                skipped.append(BulkSendSkip(application_id=application_id, reason=str(exc)))
        return BulkSendResult(queued=queued, skipped=skipped)

    # ---------- managing the log ----------

    def logs(self, application_id: int | None = None) -> list[EmailLogRead]:
        query = select(EmailLog).order_by(col(EmailLog.created_at).desc(), col(EmailLog.id).desc())
        if application_id is not None:
            query = query.where(EmailLog.application_id == application_id)
        return [EmailLogRead.model_validate(log) for log in self.session.exec(query).all()]

    def cancel(self, log_id: int) -> EmailLogRead:
        log = self._log(log_id)
        if log.status != EmailStatus.QUEUED:
            raise BadRequestError("Only emails still waiting to be sent can be cancelled.")
        log.status = EmailStatus.CANCELLED
        return self._save(log)

    def retry(self, log_id: int) -> EmailLogRead:
        log = self._log(log_id)
        if log.status != EmailStatus.FAILED:
            raise BadRequestError("Only failed emails can be retried.")
        log.status, log.error = EmailStatus.QUEUED, ""
        return self._save(log)

    def mark_applied(self, application_id: int) -> None:
        """Assisted apply: the user submitted on the job's website themselves."""
        application = self.applications.get(application_id)
        if application.status in NOT_YET_SENT:
            self.applications.update(
                application_id, ApplicationUpdate(status=ApplicationStatus.SENT)
            )

    # ---------- used by the send queue ----------

    def build_for_send(self, log: EmailLog) -> EmailMessage:
        application = self.applications.get(log.application_id)
        settings = self.settings_service.settings()
        attachments: list[tuple[str, bytes, str]] = []
        letter = self._selected_letter(log.application_id)
        if letter and log.kind == "application":
            content, filename, media_type = LetterService(self.session).export(letter.id, "pdf")
            attachments.append((filename, content, media_type))
        # The CV tailored for this job if there is one, otherwise the uploaded CV.
        tailored = TailoredCvService(self.session).attachment(log.application_id)
        cv = self._cv_for(application)
        if tailored and log.kind == "application":
            attachments.append(tailored)
        elif cv and log.kind == "application":
            path = self.cv_dir / cv.stored_name
            if path.is_file():
                attachments.append((cv.original_filename, path.read_bytes(), cv.content_type))
        return build_email(
            settings=settings,
            to=log.to_address,
            subject=log.subject,
            body=log.body,
            message_id=log.message_id,
            attachments=attachments,
            in_reply_to=log.in_reply_to,
        )

    def mark_sent(self, log: EmailLog) -> None:
        now = utcnow()
        log.status, log.sent_at, log.error = EmailStatus.SENT, now, ""
        self.session.add(log)
        self.session.commit()
        if not log.is_test:
            application = self.applications.get(log.application_id)
            changes = ApplicationUpdate(last_contact_at=now)
            if log.kind == "application":
                if application.status in NOT_YET_SENT:
                    changes.status = ApplicationStatus.SENT
                days = self.settings_service.settings().follow_up_days
                changes.follow_up_at = now + timedelta(days=days)
            elif log.kind == "follow_up":
                if application.status == ApplicationStatus.SENT:
                    changes.status = ApplicationStatus.FOLLOWED_UP
                changes.follow_up_at = None
            self.applications.update(log.application_id, changes)

    def mark_failed(self, log: EmailLog, error: str) -> None:
        log.status, log.error = EmailStatus.FAILED, error[:500]
        self.session.add(log)
        self.session.commit()

    # ---------- helpers ----------

    def _selected_letter(self, application_id: int):
        letters = self.letters.for_application(application_id)
        return next((x for x in letters if x.is_selected), letters[0] if letters else None)

    def _cv_for(self, application: Application) -> CvDocument | None:
        if application.cv_id:
            cv = self.session.get(CvDocument, application.cv_id)
            if cv:
                return cv
        return next((cv for cv in CvRepository(self.session).all() if cv.is_default), None)

    @staticmethod
    def _letter_filename(application: Application) -> str:
        return letter_filename(application.company, application.role, "pdf")

    def _has_log(self, application_id: int, statuses: tuple, real_only: bool = False) -> bool:
        query = select(EmailLog.id).where(
            EmailLog.application_id == application_id, col(EmailLog.status).in_(statuses)
        )
        if real_only:
            query = query.where(col(EmailLog.is_test).is_(False))
        return self.session.exec(query.limit(1)).first() is not None

    def _log(self, log_id: int) -> EmailLog:
        log = self.session.get(EmailLog, log_id)
        if log is None:
            raise NotFoundError("Email", log_id)
        return log

    def _save(self, log: EmailLog) -> EmailLogRead:
        self.session.add(log)
        self.session.commit()
        self.session.refresh(log)
        return EmailLogRead.model_validate(log)
