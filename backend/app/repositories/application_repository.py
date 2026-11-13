from datetime import datetime

from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.models import Application, ApplicationStatus, StatusHistory

# Allowed sort keys ("-" prefix = descending). A whitelist: never sort by raw user input.
SORT_COLUMNS = {
    "created_at": Application.created_at,
    "updated_at": Application.updated_at,
    "company": Application.company,
    "role": Application.role,
    "status": Application.status,
    "priority": Application.priority,
}


class ApplicationRepository:
    def __init__(self, session: Session):
        self.session = session

    def search(
        self,
        *,
        status: ApplicationStatus | None = None,
        search: str | None = None,
        sort: str = "-created_at",
        limit: int = 50,
        offset: int = 0,
        hide_closed: bool = False,
    ) -> tuple[list[Application], int]:
        query = select(Application)
        if status:
            query = query.where(Application.status == status)
        if hide_closed:
            closed = (ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN)
            query = query.where(col(Application.status).not_in(closed))
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(col(Application.company).ilike(pattern), col(Application.role).ilike(pattern))
            )

        column = col(SORT_COLUMNS.get(sort.lstrip("-"), Application.created_at))
        if column.key in ("company", "role"):
            column = func.lower(column)
        order = column.desc() if sort.startswith("-") else column.asc()

        total = self.session.exec(select(func.count()).select_from(query.subquery())).one()
        items = self.session.exec(
            query.order_by(order, col(Application.id).desc()).offset(offset).limit(limit)
        ).all()
        return list(items), total

    def status_counts(self) -> dict[ApplicationStatus, int]:
        rows = self.session.exec(
            select(Application.status, func.count()).group_by(Application.status)
        ).all()
        return dict(rows)

    def created_since(self, since: datetime) -> list[datetime]:
        return list(
            self.session.exec(
                select(Application.created_at).where(col(Application.created_at) >= since)
            ).all()
        )

    def follow_ups_due(
        self, before: datetime, statuses: list[ApplicationStatus]
    ) -> list[Application]:
        return list(
            self.session.exec(
                select(Application)
                .where(
                    col(Application.follow_up_at).is_not(None),
                    col(Application.follow_up_at) <= before,
                    col(Application.status).in_(statuses),
                )
                .order_by(col(Application.follow_up_at))
                .limit(20)
            ).all()
        )

    def all(self, *, status: ApplicationStatus | None = None) -> list[Application]:
        query = select(Application)
        if status:
            query = query.where(Application.status == status)
        return list(
            self.session.exec(
                query.order_by(col(Application.created_at).desc(), col(Application.id).desc())
            ).all()
        )

    def identity_rows(self) -> list[tuple[str, str, str]]:
        """(company, role, job_url) for every application, used to spot duplicates."""
        return list(
            self.session.exec(
                select(Application.company, Application.role, Application.job_url)
            ).all()
        )

    def get(self, application_id: int) -> Application | None:
        return self.session.get(Application, application_id)

    def add(self, application: Application) -> Application:
        self.session.add(application)
        self.session.flush()
        return application

    def add_many(self, applications: list[Application]) -> None:
        self.session.add_all(applications)
        self.session.flush()

    def delete(self, application: Application) -> None:
        self.session.delete(application)

    def add_history(self, entry: StatusHistory) -> None:
        self.session.add(entry)

    def history(self, application_id: int) -> list[StatusHistory]:
        return list(
            self.session.exec(
                select(StatusHistory)
                .where(StatusHistory.application_id == application_id)
                .order_by(col(StatusHistory.changed_at), col(StatusHistory.id))
            ).all()
        )
