"""The simple tracker: interview stages, next steps, the totals at the top, and the export."""

from datetime import date, datetime
from io import BytesIO

import pytest
from openpyxl import load_workbook

from app.models import Application, ApplicationStatus
from app.services.tracker import next_step

TODAY = date(2026, 11, 13)


def stage(kind="online_test", when=None, result="upcoming", note=""):
    return {
        "kind": kind,
        "date": when.isoformat() if when else None,
        "result": result,
        "note": note,
    }


def job(status="sent", stages=(), deadline="", interview=None):
    return Application(
        company="Acme Ltd",
        role="Developer",
        status=ApplicationStatus(status),
        stages=list(stages),
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
        (job("sent", [stage(when=date(2026, 11, 25))]), "Do the online test by 25 Nov"),
        (job("sent", [stage(when=date(2026, 11, 1))]), "Online test was due 1 Nov: update it"),
        (job("sent", [stage()]), "Do the online test"),
        (job("sent", [stage(result="passed")]), "Wait for news after the online test"),
        (
            job("sent", [stage(result="passed"), stage("video", date(2026, 12, 2))]),
            "Video interview on 2 Dec",
        ),
        (job("sent", [stage("assessment_centre")]), "Prepare for the assessment centre"),
        (
            job("sent", [stage("other", date(2026, 12, 5), note="Case study")]),
            "Case study on 5 Dec",
        ),
        (
            job("sent", [stage(result="passed"), stage("technical", result="failed")]),
            "Didn't pass the technical interview: update the status",
        ),
        (
            # The soonest dated stage comes first, whatever order they were added in.
            job("sent", [stage("final", date(2026, 12, 20)), stage("video", date(2026, 12, 1))]),
            "Video interview on 1 Dec",
        ),
        (job("replied"), "Read the reply"),
        (
            job("interview", interview=datetime(2026, 12, 2, 10)),
            "Prepare for the interview (2 Dec)",
        ),
        (job("offer"), "Reply to the offer"),
        (job("rejected", [stage()]), ""),
        (job("withdrawn"), ""),
        (job("sent", [{"kind": "nonsense"}]), "Wait for a reply"),  # bad data never breaks it
    ],
)
def test_next_step(application, step):
    assert next_step(application, today=TODAY) == step


def test_tracker_summary_and_columns(client, make_application):
    rows = [
        {"status": "rejected", "stages": [stage(result="passed")]},
        {"status": "sent", "stages": [stage(when=date(2099, 11, 25))]},
        {"status": "sent", "stages": [stage(result="passed"), stage("video", result="passed")]},
        {"status": "sent"},
        {"status": "interview"},
        {"status": "imported", "application_deadline": "Rolling"},
    ]
    for row in rows:
        make_application(**row)

    summary = client.get("/api/applications/summary").json()
    assert summary == {
        "total": 6,
        "to_apply": 1,
        "applied": 3,  # waiting for an answer: not the rejection or the interview
        "in_progress": 2,  # the upcoming online test and the interview
        "assessments_done": 2,
        "interviews": 2,  # a video interview stage, and the Interview status
        "offers": 0,
        "rejected": 1,
    }

    items = client.get("/api/applications?sort=created_at").json()["items"]
    upcoming = items[1]
    assert upcoming["stages"] == [
        {"kind": "online_test", "date": "2099-11-25", "result": "upcoming", "note": ""}
    ]
    assert upcoming["next_step"] == "Do the online test by 25 Nov"


def test_edit_stages(client, make_application):
    application = make_application(status="sent")
    url = f"/api/applications/{application['id']}"
    updated = client.patch(
        url, json={"stages": [{"kind": "online_test", "date": "2099-01-05"}]}
    ).json()
    assert updated["stages"][0]["result"] == "upcoming"
    assert updated["next_step"] == "Do the online test by 5 Jan"

    two = [
        {"kind": "online_test", "date": "2099-01-05", "result": "passed"},
        {"kind": "assessment_centre", "date": "2099-02-10", "note": "London office"},
    ]
    updated = client.patch(url, json={"stages": two}).json()
    assert updated["next_step"] == "Assessment centre on 10 Feb"
    assert updated["stages"][1]["note"] == "London office"

    assert client.patch(url, json={"stages": [{"kind": "lunch"}]}).status_code == 422
    assert client.patch(url, json={"stages": [{"kind": "video"}] * 21}).status_code == 422
    assert client.patch(url, json={"stages": []}).json()["stages"] == []


def test_export_uses_tracker_columns(client, make_application):
    make_application(
        status="sent",
        application_deadline="Rolling",
        stages=[stage(result="passed"), stage("assessment_centre", date(2099, 12, 12))],
    )
    content = client.get("/api/applications/export").content
    sheet = load_workbook(BytesIO(content)).active
    header = [c.value for c in sheet[1]][:6]
    assert header == ["Company", "Role", "Application deadline", "Status", "Stages", "Next step"]
    assert [c.value for c in sheet[2]][2:5] == [
        "Rolling",
        "Applied",
        "Online test ✓ · Assessment centre (12 Dec)",
    ]
