"""The simple tracker: next steps, the totals at the top, and editing the tracker columns."""

from datetime import date, datetime

import pytest

from app.models import Application, ApplicationStatus
from app.services.tracker import next_step

TODAY = date(2026, 11, 13)


def job(status="sent", assessment="", due=None, deadline="", interview=None):
    return Application(
        company="Acme Ltd",
        role="Developer",
        status=ApplicationStatus(status),
        assessment=assessment,
        assessment_due=due,
        application_deadline=deadline,
        interview_at=interview,
    )


@pytest.mark.parametrize(
    ("application", "step"),
    [
        (job("imported"), "Apply"),
        (job("imported", deadline="Rolling"), "Apply"),
        (job("drafted", deadline="30/11/2026"), "Apply by 30/11/2026"),
        (job("sent"), "Wait for a reply"),
        (job("sent", "pending", date(2026, 11, 25)), "Do the assessment by 25 Nov"),
        (job("sent", "pending", date(2026, 11, 1)), "Assessment was due 1 Nov"),
        (job("sent", "pending"), "Do the assessment"),
        (job("sent", "done"), "Wait for the assessment result"),
        (job("replied"), "Read the reply"),
        (
            job("interview", interview=datetime(2026, 12, 2, 10)),
            "Prepare for the interview (2 Dec)",
        ),
        (job("offer"), "Reply to the offer"),
        (job("rejected", "done"), ""),
        (job("withdrawn"), ""),
    ],
)
def test_next_step(application, step):
    assert next_step(application, today=TODAY) == step


def test_tracker_summary_and_columns(client, make_application):
    rows = [
        {"status": "rejected", "assessment": "done"},
        {"status": "sent", "assessment": "pending", "assessment_due": "2099-11-25"},
        {"status": "sent"},
        {"status": "interview"},
        {"status": "imported", "application_deadline": "Rolling"},
    ]
    for row in rows:
        make_application(**row)

    summary = client.get("/api/applications/summary").json()
    assert summary == {
        "total": 5,
        "to_apply": 1,
        "applied": 2,  # waiting for an answer: not the rejection or the interview
        "in_progress": 2,  # the pending assessment and the interview
        "assessments_done": 1,
        "interviews": 1,
        "offers": 0,
        "rejected": 1,
    }

    items = client.get("/api/applications?sort=created_at").json()["items"]
    pending = next(i for i in items if i["assessment"] == "pending")
    assert pending["assessment_due"] == "2099-11-25"
    assert pending["next_step"] == "Do the assessment by 25 Nov"


def test_edit_tracker_columns(client, make_application):
    application = make_application(status="sent")
    url = f"/api/applications/{application['id']}"
    updated = client.patch(
        url, json={"assessment": "pending", "assessment_due": "2099-01-05"}
    ).json()
    assert updated["next_step"] == "Do the assessment by 5 Jan"
    updated = client.patch(url, json={"assessment": "done"}).json()
    assert updated["next_step"] == "Wait for the assessment result"
    assert client.patch(url, json={"assessment": "maybe"}).status_code == 422
    cleared = client.patch(url, json={"assessment": "", "assessment_due": None}).json()
    assert (cleared["assessment"], cleared["assessment_due"]) == ("", None)


def test_export_uses_tracker_columns(client, make_application):
    from io import BytesIO

    from openpyxl import load_workbook

    make_application(status="sent", assessment="pending", application_deadline="Rolling")
    content = client.get("/api/applications/export").content
    sheet = load_workbook(BytesIO(content)).active
    header = [c.value for c in sheet[1]][:7]
    assert header == [
        "Company",
        "Role",
        "Application deadline",
        "Status",
        "Pre-assessment",
        "Assessment deadline",
        "Next step",
    ]
    assert [c.value for c in sheet[2]][2:5] == ["Rolling", "Applied", "Pending"]
