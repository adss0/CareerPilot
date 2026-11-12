from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from app.models import ApplicationStatus as S
from app.repositories.application_repository import ApplicationRepository
from app.schemas.stats import FollowUpDue, StatsRead, WeekCount

SENT_OR_LATER = [S.SENT, S.FOLLOWED_UP, S.INTERVIEW, S.OFFER, S.REJECTED]
RESPONDED = [S.INTERVIEW, S.OFFER, S.REJECTED]
AWAITING_REPLY = [S.SENT, S.FOLLOWED_UP]
WEEKS = 8


def _naive(value: datetime) -> datetime:
    # SQLite gives back naive datetimes (stored as UTC); compare like with like.
    return value.replace(tzinfo=None) if value.tzinfo else value


class StatsService:
    def __init__(self, session: Session, now: datetime | None = None):
        self.repo = ApplicationRepository(session)
        self.now = _naive(now or datetime.now(UTC))

    def get(self) -> StatsRead:
        counts = self.repo.status_counts()
        by_status = {status: counts.get(status, 0) for status in S}
        sent = sum(by_status[s] for s in SENT_OR_LATER)
        responses = sum(by_status[s] for s in RESPONDED)

        monday = (self.now - timedelta(days=self.now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        first_week = monday - timedelta(weeks=WEEKS - 1)
        weekly = [0] * WEEKS
        for created in self.repo.created_since(first_week):
            index = (_naive(created) - first_week).days // 7
            if 0 <= index < WEEKS:
                weekly[index] += 1

        due = self.repo.follow_ups_due(self.now + timedelta(days=7), AWAITING_REPLY)
        return StatsRead(
            total=sum(by_status.values()),
            by_status=by_status,
            added_this_week=weekly[-1],
            sent=sent,
            responses=responses,
            interviews=by_status[S.INTERVIEW] + by_status[S.OFFER],
            response_rate=round(responses / sent, 3) if sent else None,
            added_per_week=[
                WeekCount(week_start=(first_week + timedelta(weeks=i)).date().isoformat(), count=c)
                for i, c in enumerate(weekly)
            ],
            follow_ups_due=[
                FollowUpDue(
                    id=a.id,
                    company=a.company,
                    role=a.role,
                    follow_up_at=a.follow_up_at,
                    overdue=_naive(a.follow_up_at) <= self.now,
                )
                for a in due
            ],
        )
