from sqlmodel import Session

from app.core.errors import BadRequestError, NotFoundError
from app.models import Application, ApplicationStatus, CvDocument, StatusHistory
from app.models.tables import utcnow
from app.repositories.application_repository import ApplicationRepository
from app.repositories.letter_repository import LetterRepository
from app.schemas.application import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationUpdate,
    BulkApplicationAction,
    BulkApplicationResult,
    TrackerSummary,
)
from app.services.excel_export import build_applications_workbook
from app.services.tracker import due_label, next_step, tracker_summary

# Fields that may be cleared with null; null for any other field is ignored.
NULLABLE_FIELDS = {
    "contact_email",
    "assessment_due",
    "applied_at",
    "last_contact_at",
    "follow_up_at",
    "interview_at",
    "cv_id",
}


class ApplicationService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ApplicationRepository(session)

    def search(self, **filters) -> tuple[list[Application], int]:
        return self.repo.search(**filters)

    def to_read(self, applications: list[Application]) -> list[ApplicationRead]:
        """Read models including each application's letter count and match score."""
        summaries = LetterRepository(self.session).summaries([a.id for a in applications])
        reads = []
        for application in applications:
            count, score = summaries.get(application.id, (0, None))
            read = ApplicationRead.model_validate(application)
            due = due_label(application)
            reads.append(
                read.model_copy(
                    update={
                        "letter_count": count,
                        "match_score": score,
                        "next_step": next_step(application),
                        "due_label": due[0],
                        "due_level": due[1],
                    }
                )
            )
        return reads

    def export_workbook(self, *, status: ApplicationStatus | None = None) -> bytes:
        return build_applications_workbook(self.repo.all(status=status))

    def get(self, application_id: int) -> Application:
        application = self.repo.get(application_id)
        if application is None:
            raise NotFoundError("Application", application_id)
        return application

    def create(self, data: ApplicationCreate) -> Application:
        values = data.model_dump()
        values["contact_email"] = values["contact_email"] or ""
        self._check_cv(values["cv_id"])
        application = self.repo.add(Application(**values))
        self._record_status(application, None, application.status)
        if application.status == ApplicationStatus.SENT:
            application.applied_at = utcnow()
        self.session.commit()
        self.session.refresh(application)
        return application

    def update(self, application_id: int, data: ApplicationUpdate) -> Application:
        application = self.get(application_id)
        changes = {
            field: value
            for field, value in data.model_dump(exclude_unset=True).items()
            if value is not None or field in NULLABLE_FIELDS
        }
        if "contact_email" in changes:
            changes["contact_email"] = changes["contact_email"] or ""
        if "cv_id" in changes:
            self._check_cv(changes["cv_id"])

        old_status = application.status
        for field, value in changes.items():
            setattr(application, field, value)

        if application.status != old_status:
            self._record_status(application, old_status, application.status)
            if application.status == ApplicationStatus.SENT and application.applied_at is None:
                application.applied_at = utcnow()

        application.updated_at = utcnow()
        self.session.commit()
        self.session.refresh(application)
        return application

    def bulk(self, data: BulkApplicationAction) -> BulkApplicationResult:
        affected, missing = 0, []
        for application_id in dict.fromkeys(data.application_ids):
            try:
                if data.action == "delete":
                    self.delete(application_id)
                else:
                    self.update(application_id, ApplicationUpdate(status=data.status))
                affected += 1
            except NotFoundError:
                missing.append(application_id)
        return BulkApplicationResult(affected=affected, missing=missing)

    def delete(self, application_id: int) -> None:
        self.repo.delete(self.get(application_id))
        self.session.commit()

    def _check_cv(self, cv_id: int | None) -> None:
        if cv_id is not None and self.session.get(CvDocument, cv_id) is None:
            raise BadRequestError(f"CV {cv_id} not found.")

    def history(self, application_id: int) -> list[StatusHistory]:
        self.get(application_id)
        return self.repo.history(application_id)

    def _record_status(
        self,
        application: Application,
        old: ApplicationStatus | None,
        new: ApplicationStatus,
    ) -> None:
        self.repo.add_history(
            StatusHistory(application_id=application.id, from_status=old, to_status=new)
        )

    def tracker_summary(self) -> TrackerSummary:
        return tracker_summary(self.repo.all())
