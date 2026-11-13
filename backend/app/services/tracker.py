"""The tracker's "Next step" column and the totals above it."""

from datetime import date

from app.models import Application, ApplicationStatus
from app.schemas.application import DueItem, TrackerSummary
from app.services.import_service import parse_day

NOT_APPLIED = {ApplicationStatus.IMPORTED, ApplicationStatus.DRAFTED, ApplicationStatus.READY}
WAITING = {ApplicationStatus.SENT, ApplicationStatus.FOLLOWED_UP, ApplicationStatus.REPLIED}
CLOSED = {ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN}


def _day(value: date) -> str:
    return f"{value.day} {value:%b}"


def next_step(application: Application, today: date | None = None) -> str:
    today = today or date.today()
    status = application.status
    due = application.assessment_due
    if status in CLOSED:
        return ""
    if status == ApplicationStatus.OFFER:
        return "Reply to the offer"
    if status == ApplicationStatus.INTERVIEW:
        when = application.interview_at
        return (
            f"Prepare for the interview ({_day(when.date())})"
            if when
            else "Prepare for the interview"
        )
    if application.assessment == "pending":
        if due and due < today:
            return f"Assessment was due {_day(due)}"
        return f"Do the assessment by {_day(due)}" if due else "Do the assessment"
    if status in NOT_APPLIED:
        deadline = application.application_deadline.strip()
        if deadline and deadline.casefold() != "rolling":
            return f"Apply by {deadline}"
        return "Apply"
    if application.assessment == "done":
        return "Wait for the assessment result"
    if status == ApplicationStatus.REPLIED:
        return "Read the reply"
    return "Wait for a reply"


def tracker_summary(applications: list[Application]) -> TrackerSummary:
    def count(statuses: set[ApplicationStatus]) -> int:
        return sum(a.status in statuses for a in applications)

    open_ = [a for a in applications if a.status not in CLOSED | NOT_APPLIED]
    return TrackerSummary(
        total=len(applications),
        to_apply=count(NOT_APPLIED),
        # Applied and still waiting (like a tracker's "Applied" column: rejections are separate).
        applied=count(WAITING),
        # Still alive and moving: an assessment to do, a reply, or an interview.
        in_progress=sum(
            a.assessment == "pending"
            or a.status in {ApplicationStatus.REPLIED, ApplicationStatus.INTERVIEW}
            for a in open_
        ),
        assessments_done=sum(a.assessment == "done" for a in applications),
        interviews=count({ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER}),
        offers=count({ApplicationStatus.OFFER}),
        rejected=count({ApplicationStatus.REJECTED}),
    )


DUE_DAYS = 7


def _when(days: int) -> str:
    if days == 0:
        return "today"
    if days == 1:
        return "tomorrow"
    if days < 0:
        return f"{-days} day{'s' if days != -1 else ''} ago"
    return f"in {days} days"


def due_dates(application: Application, today: date | None = None) -> list[DueItem]:
    """The dates that matter for an open job: its closing date (until you apply) and a pending
    assessment's deadline."""
    today = today or date.today()
    items: list[DueItem] = []
    if application.status in CLOSED:
        return items
    closes = parse_day(application.application_deadline)
    if closes and application.status in NOT_APPLIED:
        days = (closes - today).days
        verb = "Closed" if days < 0 else "Closes"
        items.append(
            DueItem(
                application_id=application.id or 0,
                company=application.company,
                role=application.role,
                kind="deadline",
                date=closes,
                days_left=days,
                label=f"{verb} {_when(days)}",
            )
        )
    if application.assessment == "pending" and application.assessment_due:
        days = (application.assessment_due - today).days
        verb = "Assessment was due" if days < 0 else "Assessment due"
        items.append(
            DueItem(
                application_id=application.id or 0,
                company=application.company,
                role=application.role,
                kind="assessment",
                date=application.assessment_due,
                days_left=days,
                label=f"{verb} {_when(days)}",
            )
        )
    return items


def due_label(application: Application, today: date | None = None) -> tuple[str, str]:
    """The most urgent date within a week, as (label, level) for the tracker."""
    urgent = [d for d in due_dates(application, today) if d.days_left <= DUE_DAYS]
    if not urgent:
        return "", ""
    first = min(urgent, key=lambda d: d.days_left)
    return first.label, "overdue" if first.days_left < 0 else "soon"


def due_items(
    applications: list[Application], days: int = DUE_DAYS, today: date | None = None
) -> list[DueItem]:
    items = [
        item
        for application in applications
        for item in due_dates(application, today)
        if item.days_left <= days and item.days_left >= -14  # forget long-gone dates
    ]
    return sorted(items, key=lambda d: d.days_left)
