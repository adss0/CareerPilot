from sqlmodel import Session

from app.core.errors import NotFoundError
from app.models import Application, ApplicationStatus, StatusHistory
from app.models.tables import utcnow
from app.repositories.application_repository import ApplicationRepository
from app.schemas.application import ApplicationCreate, ApplicationUpdate
from app.services.excel_export import build_applications_workbook

# Fields that may be cleared with null; null for any other field is ignored.
NULLABLE_FIELDS = {"contact_email", "applied_at", "last_contact_at", "follow_up_at"}


class ApplicationService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ApplicationRepository(session)

    def search(self, **filters) -> tuple[list[Application], int]:
        return self.repo.search(**filters)

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

    def delete(self, application_id: int) -> None:
        self.repo.delete(self.get(application_id))
        self.session.commit()

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
