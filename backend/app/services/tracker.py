"""The tracker's "Next step" column and the totals above it."""

from datetime import date

from app.models import Application, ApplicationStatus
from app.schemas.application import TrackerSummary

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
