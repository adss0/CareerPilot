from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, select

from app.models import Application, CoverLetter, CvDocument, EmailLog, InboxReply
from app.models import ApplicationStatus as S
from app.repositories.application_repository import ApplicationRepository
from app.schemas.stats import Breakdown, FollowUpDue, StatsRead, WeekCount

SENT_OR_LATER = [S.SENT, S.FOLLOWED_UP, S.REPLIED, S.INTERVIEW, S.OFFER, S.REJECTED]
RESPONDED = [S.REPLIED, S.INTERVIEW, S.OFFER, S.REJECTED]
AWAITING_REPLY = [S.SENT, S.FOLLOWED_UP]
WEEKS = 8


def _naive(value: datetime) -> datetime:
    # SQLite gives back naive datetimes (stored as UTC); compare like with like.
    return value.replace(tzinfo=None) if value.tzinfo else value


class StatsService:
    def __init__(self, session: Session, now: datetime | None = None):
        self.session = session
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
            avg_days_to_reply=self._avg_days_to_reply(),
            by_tone=self._breakdown("tone"),
            by_cv=self._breakdown("cv"),
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

    def _avg_days_to_reply(self) -> float | None:
        rows = self.session.exec(
            select(InboxReply.received_at, EmailLog.sent_at)
            .join(EmailLog, col(InboxReply.email_log_id) == col(EmailLog.id))
            .where(col(EmailLog.is_test).is_(False), col(EmailLog.sent_at).is_not(None))
        ).all()
        days = [(_naive(r) - _naive(s)).total_seconds() / 86400 for r, s in rows]
        return round(sum(days) / len(days), 1) if days else None

    def _breakdown(self, by: str) -> list[Breakdown]:
        """Response rate per letter tone or per CV, over applications that have gone out."""
        applications = self.session.exec(
            select(Application).where(col(Application.status).in_(SENT_OR_LATER))
        ).all()
        if not applications:
            return []
        cvs = {cv.id: cv for cv in self.session.exec(select(CvDocument)).all()}
        default_cv = next((cv.label for cv in cvs.values() if cv.is_default), "No CV")
        tones = dict(
            self.session.exec(
                select(CoverLetter.application_id, CoverLetter.tone).where(
                    col(CoverLetter.is_selected).is_(True)
                )
            ).all()
        )
        groups: dict[str, list[bool]] = {}
        for a in applications:
            if by == "tone":
                label = tones.get(a.id)
                if label is None:
                    continue  # applied without a CareerPilot letter
                label = label.capitalize()
            else:
                label = cvs[a.cv_id].label if a.cv_id in cvs else default_cv
            groups.setdefault(label, []).append(a.status in RESPONDED)
        return sorted(
            (
                Breakdown(
                    label=label,
                    sent=len(results),
                    responses=sum(results),
                    rate=round(sum(results) / len(results), 3),
                )
                for label, results in groups.items()
            ),
            key=lambda b: (-b.sent, b.label),
        )
