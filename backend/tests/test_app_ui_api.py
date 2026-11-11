from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from app.models import Application
from app.services.stats_service import StatsService


def names(client, **params) -> list[str]:
    return [a["company"] for a in client.get("/api/applications", params=params).json()["items"]]


def test_sorting(client, make_application):
    make_application(company="beta", role="Z", priority=1)
    make_application(company="Alpha", role="Y", priority=3)
    make_application(company="Gamma", role="X", priority=2)

    assert names(client) == ["Gamma", "Alpha", "beta"]  # newest first by default
    assert names(client, sort="company") == ["Alpha", "beta", "Gamma"]  # case-insensitive
    assert names(client, sort="-company") == ["Gamma", "beta", "Alpha"]
    assert names(client, sort="-priority") == ["Alpha", "Gamma", "beta"]
    assert client.get("/api/applications", params={"sort": "drop table"}).status_code == 422


def test_bulk_status_change_records_history(client, make_application):
    ids = [make_application(company=f"C{i}")["id"] for i in range(3)]

    result = client.post(
        "/api/applications/bulk",
        json={"application_ids": [*ids[:2], 999], "action": "set_status", "status": "ready"},
    ).json()

    assert result == {"affected": 2, "missing": [999]}
    statuses = {a["id"]: a["status"] for a in client.get("/api/applications").json()["items"]}
    assert statuses == {ids[0]: "ready", ids[1]: "ready", ids[2]: "imported"}
    history = client.get(f"/api/applications/{ids[0]}/history").json()
    assert history[-1]["to_status"] == "ready"


def test_bulk_delete_and_validation(client, make_application):
    ids = [make_application(company=f"C{i}")["id"] for i in range(2)]
    result = client.post(
        "/api/applications/bulk", json={"application_ids": ids, "action": "delete"}
    ).json()
    assert result["affected"] == 2
    assert client.get("/api/applications").json()["total"] == 0

    no_status = {"application_ids": [1], "action": "set_status"}
    assert client.post("/api/applications/bulk", json=no_status).status_code == 422
    assert (
        client.post(
            "/api/applications/bulk", json={"application_ids": [], "action": "delete"}
        ).status_code
        == 422
    )


def test_stats(client, session: Session, make_application):
    for status in ["imported", "drafted", "sent", "sent", "interview", "rejected"]:
        make_application(company=status, status=status)

    now = datetime(2026, 11, 11, 12, tzinfo=UTC)  # a Wednesday
    for application_id in range(1, 7):  # fixed dates, so the test passes on any day
        session.get(Application, application_id).created_at = now - timedelta(hours=1)
    old = session.get(Application, 1)
    old.created_at = now - timedelta(weeks=3)
    due = session.get(Application, 3)  # sent
    due.follow_up_at = now - timedelta(days=1)
    soon = session.get(Application, 4)  # sent
    soon.follow_up_at = now + timedelta(days=3)
    finished = session.get(Application, 6)  # rejected: no follow-up needed
    finished.follow_up_at = now
    session.commit()

    stats = StatsService(session, now=now).get()

    assert stats.total == 6
    assert stats.sent == 4  # sent ×2, interview, rejected
    assert stats.responses == 2
    assert stats.response_rate == 0.5
    assert stats.interviews == 1
    assert len(stats.added_per_week) == 8
    assert sum(w.count for w in stats.added_per_week) == 6
    assert stats.added_per_week[-4].count == 1  # the one created 3 weeks ago
    assert [(f.company, f.overdue) for f in stats.follow_ups_due] == [
        ("sent", True),
        ("sent", False),
    ]


def test_stats_endpoint_with_nothing_sent(client):
    body = client.get("/api/stats").json()
    assert body["total"] == 0
    assert body["response_rate"] is None
    assert body["by_status"]["imported"] == 0
