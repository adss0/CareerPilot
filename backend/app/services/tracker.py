"""The tracker's "Next step" column, its due dates, and the totals above it.

Interview stages (online test, video interview, assessment centre...) drive most of it: the
next upcoming stage is what you do next, and its date is what's due.
"""

from datetime import date

from app.models import Application, ApplicationStatus
from app.schemas.application import STAGE_LABELS, DueItem, Stage, TrackerSummary
from app.services.import_service import parse_day

NOT_APPLIED = {ApplicationStatus.IMPORTED, ApplicationStatus.DRAFTED, ApplicationStatus.READY}
WAITING = {ApplicationStatus.SENT, ApplicationStatus.FOLLOWED_UP, ApplicationStatus.REPLIED}
CLOSED = {ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN}
TESTS = {"online_test"}
INTERVIEWS = {"video", "phone", "technical", "assessment_centre", "final"}
DUE_DAYS = 7


def _day(value: date) -> str:
    return f"{value.day} {value:%b}"


def stages(application: Application) -> list[Stage]:
    result = []
    for raw in application.stages or []:
        try:
            result.append(Stage.model_validate(raw))
        except ValueError:
            continue  # an unreadable stage never breaks the tracker
    return result


def stage_name(stage: Stage) -> str:
    return (
        stage.note.strip()
        if stage.kind == "other" and stage.note.strip()
        else (STAGE_LABELS[stage.kind])
    )


def next_stage(application: Application) -> Stage | None:
    upcoming = [s for s in stages(application) if s.result == "upcoming"]
    # Dated stages first, soonest first; undated ones after, in the order they were added.
    upcoming.sort(key=lambda s: (s.date is None, s.date or date.max))
    return upcoming[0] if upcoming else None


def _stage_step(stage: Stage, today: date) -> str:
    name = stage_name(stage)
    if stage.date is None:
        return (
            f"Do the {name.lower()}" if stage.kind in TESTS else f"Prepare for the {name.lower()}"
        )
    if stage.date < today:
        return f"{name} was due {_day(stage.date)}: update it"
    if stage.kind in TESTS:
        return f"Do the {name.lower()} by {_day(stage.date)}"
    return f"{name} on {_day(stage.date)}"


def next_step(application: Application, today: date | None = None) -> str:
    today = today or date.today()
    status = application.status
    if status in CLOSED:
        return ""
    if status == ApplicationStatus.OFFER:
        return "Reply to the offer"
    upcoming = next_stage(application)
    if upcoming:
        return _stage_step(upcoming, today)
    done = stages(application)
    if done and done[-1].result == "failed":
        return f"Didn't pass the {stage_name(done[-1]).lower()}: update the status"
    if status == ApplicationStatus.INTERVIEW:
        when = application.interview_at
        return (
            f"Prepare for the interview ({_day(when.date())})"
            if when
            else ("Prepare for the interview")
        )
    if status in NOT_APPLIED:
        deadline = application.application_deadline.strip()
        if deadline and deadline.casefold() != "rolling":
            return f"Apply by {deadline}"
        return "Apply"
    if done and done[-1].result == "passed":
        return f"Wait for news after the {stage_name(done[-1]).lower()}"
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
        # Still alive and moving: a stage coming up, a reply, or an interview.
        in_progress=sum(
            next_stage(a) is not None
            or a.status in {ApplicationStatus.REPLIED, ApplicationStatus.INTERVIEW}
            for a in open_
        ),
        assessments_done=sum(
            any(s.kind in TESTS and s.result != "upcoming" for s in stages(a)) for a in applications
        ),
        # Reached an interview: an interview stage, or the Interview/Offer status.
        interviews=sum(
            a.status in {ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER}
            or any(s.kind in INTERVIEWS for s in stages(a))
            for a in applications
        ),
        offers=count({ApplicationStatus.OFFER}),
        rejected=count({ApplicationStatus.REJECTED}),
    )


def _when(days: int) -> str:
    if days == 0:
        return "today"
    if days == 1:
        return "tomorrow"
    if days < 0:
        return f"{-days} day{'s' if days != -1 else ''} ago"
    return f"in {days} days"


def due_dates(application: Application, today: date | None = None) -> list[DueItem]:
    """The dates that matter for an open job: its closing date (until you apply) and every
    upcoming stage's date."""
    today = today or date.today()
    items: list[DueItem] = []
    if application.status in CLOSED:
        return items

    def item(kind: str, when: date, label: str) -> DueItem:
        return DueItem(
            application_id=application.id or 0,
            company=application.company,
            role=application.role,
            kind=kind,
            date=when,
            days_left=(when - today).days,
            label=label,
        )

    closes = parse_day(application.application_deadline)
    if closes and application.status in NOT_APPLIED:
        days = (closes - today).days
        items.append(
            item("deadline", closes, f"{'Closed' if days < 0 else 'Closes'} {_when(days)}")
        )
    for stage in stages(application):
        if stage.result != "upcoming" or stage.date is None:
            continue
        days = (stage.date - today).days
        name = stage_name(stage)
        if stage.kind in TESTS:
            label = f"{name} {'was due' if days < 0 else 'due'} {_when(days)}"
        else:
            label = f"{name} {_when(days)}" if days >= 0 else f"{name} was {_when(days)}"
        items.append(item("stage", stage.date, label))
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
        if -14 <= item.days_left <= days  # forget long-gone dates
    ]
    return sorted(items, key=lambda d: d.days_left)
