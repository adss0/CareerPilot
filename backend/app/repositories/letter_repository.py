from sqlalchemy import func
from sqlmodel import Session, col, select, update

from app.models import CoverLetter


class LetterRepository:
    def __init__(self, session: Session):
        self.session = session

    def for_application(self, application_id: int) -> list[CoverLetter]:
        return list(
            self.session.exec(
                select(CoverLetter)
                .where(CoverLetter.application_id == application_id)
                .order_by(col(CoverLetter.version).desc())
            ).all()
        )

    def get(self, letter_id: int) -> CoverLetter | None:
        return self.session.get(CoverLetter, letter_id)

    def next_version(self, application_id: int) -> int:
        current = self.session.exec(
            select(func.max(CoverLetter.version)).where(
                CoverLetter.application_id == application_id
            )
        ).one()
        return (current or 0) + 1

    def unselect_all(self, application_id: int) -> None:
        self.session.exec(
            update(CoverLetter)
            .where(col(CoverLetter.application_id) == application_id)
            .values(is_selected=False)
        )

    def add(self, letter: CoverLetter) -> CoverLetter:
        self.session.add(letter)
        self.session.flush()
        return letter

    def delete(self, letter: CoverLetter) -> None:
        self.session.delete(letter)

    def summaries(self, application_ids: list[int]) -> dict[int, tuple[int, int | None]]:
        """application_id → (number of letters, match score of the selected letter)."""
        if not application_ids:
            return {}
        counts = dict(
            self.session.exec(
                select(CoverLetter.application_id, func.count())
                .where(col(CoverLetter.application_id).in_(application_ids))
                .group_by(CoverLetter.application_id)
            ).all()
        )
        scores = dict(
            self.session.exec(
                select(CoverLetter.application_id, CoverLetter.match_score).where(
                    col(CoverLetter.application_id).in_(application_ids),
                    col(CoverLetter.is_selected).is_(True),
                )
            ).all()
        )
        return {app_id: (count, scores.get(app_id)) for app_id, count in counts.items()}
