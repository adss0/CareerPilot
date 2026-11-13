"""Deadlines and assessments due, and hiding closed jobs in the tracker."""

from datetime import date

from app.models import Application, ApplicationStatus
from app.services.tracker import due_items, due_label

TODAY = date(2026, 11, 13)


def job(id, status="sent", assessment="", due=None, deadline=""):
    return Application(
        id=id,
        company=f"Company {id}",
        role="Developer",
        status=ApplicationStatus(status),
        assessment=assessment,
        assessment_due=due,
        application_deadline=deadline,
    )


def test_due_dates_and_labels():
    closing = job(1, "imported", deadline="16/11/2026")
    overdue = job(2, "sent", "pending", date(2026, 11, 12))
    rolling = job(3, "imported", deadline="Rolling")
    applied = job(4, "sent", deadline="14/11/2026")  # applied: the closing date no longer matters
    later = job(5, "sent", "pending", date(2026, 12, 25))
    rejected = job(6, "rejected", "pending", date(2026, 11, 14))
    today = job(7, "sent", "pending", TODAY)
    tomorrow = job(8, "drafted", deadline="14/11/2026")

    assert due_label(closing, TODAY) == ("Closes in 3 days", "soon")
    assert due_label(overdue, TODAY) == ("Assessment was due 1 day ago", "overdue")
    assert due_label(today, TODAY) == ("Assessment due today", "soon")
    assert due_label(tomorrow, TODAY) == ("Closes tomorrow", "soon")
    assert due_label(rolling, TODAY) == ("", "")
    assert due_label(later, TODAY) == ("", "")

    items = due_items(
        [closing, overdue, rolling, applied, later, rejected, today, tomorrow], today=TODAY
    )
    assert [(i.application_id, i.kind, i.days_left) for i in items] == [
        (2, "assessment", -1),
        (7, "assessment", 0),
        (8, "deadline", 1),
        (1, "deadline", 3),
    ]


def test_due_endpoint_and_hide_closed(client, make_application):
    make_application(
        company="Open",
        status="sent",
        assessment="pending",
        assessment_due=date.today().isoformat(),
    )
    make_application(company="Closed", status="rejected")
    due = client.get("/api/applications/due").json()
    assert [(d["company"], d["label"]) for d in due] == [("Open", "Assessment due today")]

    items = client.get("/api/applications").json()["items"]
    assert {i["company"] for i in items} == {"Open", "Closed"}
    open_only = client.get("/api/applications?hide_closed=true").json()
    assert [i["company"] for i in open_only["items"]] == ["Open"]
    assert open_only["items"][0]["due_label"] == "Assessment due today"
    assert open_only["items"][0]["due_level"] == "soon"
