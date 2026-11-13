"""The calendar shows interview stages and closing dates; tests coming up are announced."""

from datetime import date, timedelta


def iso(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def test_calendar_shows_stages_and_closing_dates(client, make_application):
    make_application(
        company="Acme Ltd",
        status="sent",
        stages=[
            {"kind": "online_test", "date": iso(2), "result": "passed"},
            {"kind": "assessment_centre", "date": iso(5)},
            {"kind": "video"},  # no date: not on the calendar
        ],
    )
    closing = (date.today() + timedelta(days=3)).strftime("%d/%m/%Y")
    make_application(company="Globex", status="imported", application_deadline=closing)
    make_application(company="Applied Co", status="sent", application_deadline=closing)

    start, end = iso(-1), iso(30)
    events = client.get(f"/api/calendar?start={start}T00:00:00&end={end}T00:00:00").json()
    summary = [(e["kind"], e["company"], e["label"], e["result"], e["date"][:10]) for e in events]
    assert summary == [
        ("stage", "Acme Ltd", "Online test", "passed", iso(2)),
        ("deadline", "Globex", "Closing date", "", iso(3)),  # applied jobs' dates don't matter
        ("stage", "Acme Ltd", "Assessment centre", "upcoming", iso(5)),
    ]
    outside = client.get(f"/api/calendar?start={iso(10)}T00:00:00&end={iso(20)}T00:00:00")
    assert outside.json() == []


def test_tests_and_interviews_coming_up_are_announced(client, make_application):
    make_application(
        company="Acme Ltd",
        status="sent",
        stages=[
            {"kind": "online_test", "date": iso(1)},
            {"kind": "video", "date": iso(10)},  # too far off
        ],
    )
    make_application(
        company="Done Co",
        status="sent",
        stages=[{"kind": "final", "date": iso(0), "result": "passed"}],
    )
    make_application(company="Late Co", status="sent", stages=[{"kind": "phone", "date": iso(-1)}])
    make_application(
        company="Closed Co", status="rejected", stages=[{"kind": "phone", "date": iso(0)}]
    )
    make_application(company="Today Co", status="sent", stages=[{"kind": "phone", "date": iso(0)}])

    upcoming = client.get("/api/notifications").json()["upcoming"]
    assert [(u["company"], u["label"]) for u in upcoming] == [
        ("Today Co", "Phone screen today"),
        ("Acme Ltd", "Online test due tomorrow"),
    ]
