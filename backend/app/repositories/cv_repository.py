from sqlmodel import Session, col, select, update

from app.models import CvDocument


class CvRepository:
    def __init__(self, session: Session):
        self.session = session

    def all(self) -> list[CvDocument]:
        return list(
            self.session.exec(
                select(CvDocument).order_by(
                    col(CvDocument.is_default).desc(), col(CvDocument.created_at).desc()
                )
            ).all()
        )

    def get(self, cv_id: int) -> CvDocument | None:
        return self.session.get(CvDocument, cv_id)

    def exists(self) -> bool:
        return self.session.exec(select(CvDocument.id).limit(1)).first() is not None

    def add(self, cv: CvDocument) -> CvDocument:
        self.session.add(cv)
        self.session.flush()
        return cv

    def delete(self, cv: CvDocument) -> None:
        self.session.delete(cv)

    def clear_default(self) -> None:
        self.session.exec(update(CvDocument).values(is_default=False))
