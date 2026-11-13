"""Deadlines and interview stages due, and hiding closed jobs in the tracker."""

from datetime import date, timedelta

from app.models import Application, ApplicationStatus
from app.services.tracker import due_items, due_label

TODAY = date(2026, 11, 13)


def stage(kind, when, result="upcoming"):
    return {"kind": kind, "date": when.isoformat(), "result": result, "note": ""}


def job(id, status="sent", stages=(), deadline=""):
    return Application(
        id=id,
        company=f"Company {id}",
        role="Developer",
        status=ApplicationStatus(status),
        stages=list(stages),
        application_deadline=deadline,
    )


def test_due_dates_and_labels():
    closing = job(1, "imported", deadline="16/11/2026")
    overdue = job(2, "sent", [stage("online_test", date(2026, 11, 12))])
    rolling = job(3, "imported", deadline="Rolling")
    applied = job(4, "sent", deadline="14/11/2026")  # applied: the closing date no longer matters
    later = job(5, "sent", [stage("video", date(2026, 12, 25))])
    rejected = job(6, "rejected", [stage("online_test", date(2026, 11, 14))])
    today = job(7, "sent", [stage("video", TODAY)])
    tomorrow = job(8, "drafted", deadline="14/11/2026")
    passed = job(9, "sent", [stage("final", date(2026, 11, 14), "passed")])

    assert due_label(closing, TODAY) == ("Closes in 3 days", "soon")
    assert due_label(overdue, TODAY) == ("Online test was due 1 day ago", "overdue")
    assert due_label(today, TODAY) == ("Video interview today", "soon")
    assert due_label(tomorrow, TODAY) == ("Closes tomorrow", "soon")
    assert due_label(rolling, TODAY) == ("", "")
    assert due_label(later, TODAY) == ("", "")
    assert due_label(passed, TODAY) == ("", "")

    items = due_items(
        [closing, overdue, rolling, applied, later, rejected, today, tomorrow, passed],
        today=TODAY,
    )
    assert [(i.application_id, i.kind, i.days_left) for i in items] == [
        (2, "stage", -1),
        (7, "stage", 0),
        (8, "deadline", 1),
        (1, "deadline", 3),
    ]


def test_due_endpoint_and_hide_closed(client, make_application):
    soon = (date.today() + timedelta(days=2)).isoformat()
    make_application(
        company="Open",
        status="sent",
        stages=[{"kind": "assessment_centre", "date": soon}],
    )
    make_application(company="Closed", status="rejected")
    due = client.get("/api/applications/due").json()
    assert [(d["company"], d["label"]) for d in due] == [("Open", "Assessment centre in 2 days")]

    items = client.get("/api/applications").json()["items"]
    assert {i["company"] for i in items} == {"Open", "Closed"}
    open_only = client.get("/api/applications?hide_closed=true").json()
    assert [i["company"] for i in open_only["items"]] == ["Open"]
    assert open_only["items"][0]["due_label"] == "Assessment centre in 2 days"
    assert open_only["items"][0]["due_level"] == "soon"
