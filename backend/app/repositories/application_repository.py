from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.models import Application, ApplicationStatus, StatusHistory


class ApplicationRepository:
    def __init__(self, session: Session):
        self.session = session

    def search(
        self,
        *,
        status: ApplicationStatus | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Application], int]:
        query = select(Application)
        if status:
            query = query.where(Application.status == status)
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(col(Application.company).ilike(pattern), col(Application.role).ilike(pattern))
            )

        total = self.session.exec(select(func.count()).select_from(query.subquery())).one()
        items = self.session.exec(
            query.order_by(col(Application.created_at).desc(), col(Application.id).desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return list(items), total

    def get(self, application_id: int) -> Application | None:
        return self.session.get(Application, application_id)

    def add(self, application: Application) -> Application:
        self.session.add(application)
        self.session.flush()
        return application

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
