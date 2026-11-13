"""Deleting jobs: the recycle bin (30 days, restore), deleting selected, and deleting everything."""

from datetime import timedelta
from pathlib import Path

import pytest
from sqlmodel import Session, select

from app.api.backup import get_backup_service
from app.main import app
from app.models import CoverLetter, RecycledApplication, StatusHistory
from app.models.tables import utcnow
from app.services.backup_service import BackupService
from tests.test_ai import FakeAI
from tests.test_letters import PROFILE, ai_reply


def test_delete_goes_to_the_bin_and_restores_everything(client, ai, make_application):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(ai_reply())
    job = make_application(company="Acme Ltd", status="sent", notes="Keep me")
    client.post(f"/api/applications/{job['id']}/letters", json={})

    assert client.delete(f"/api/applications/{job['id']}").status_code == 204
    assert client.get(f"/api/applications/{job['id']}").status_code == 404
    [item] = client.get("/api/bin").json()
    assert (item["company"], item["role"], item["status"]) == (
        "Acme Ltd",
        "Junior Developer",
        "sent",
    )
    assert item["expires_at"] > item["deleted_at"]

    restored = client.post(f"/api/bin/{item['id']}/restore").json()
    assert (restored["company"], restored["notes"], restored["status"]) == (
        "Acme Ltd",
        "Keep me",
        "sent",
    )
    assert restored["letter_count"] == 1
    letters = client.get(f"/api/applications/{restored['id']}/letters").json()
    assert "FastAPI service" in letters[0]["content"]
    history = client.get(f"/api/applications/{restored['id']}/history").json()
    assert [h["to_status"] for h in history][-1] == "sent"
    assert client.get("/api/bin").json() == []
    assert client.post(f"/api/bin/{item['id']}/restore").status_code == 404


def test_delete_selected_forever_and_empty(client, make_application, session: Session):
    ids = [make_application(company=f"C{i}")["id"] for i in range(3)]
    result = client.post(
        "/api/applications/bulk", json={"application_ids": ids[:2] + [999], "action": "delete"}
    ).json()
    assert result == {"affected": 2, "missing": [999]}
    items = client.get("/api/bin").json()
    assert {i["company"] for i in items} == {"C0", "C1"}

    assert client.delete(f"/api/bin/{items[0]['id']}").status_code == 204
    assert len(client.get("/api/bin").json()) == 1
    assert client.delete("/api/bin").status_code == 204
    assert client.get("/api/bin").json() == []
    assert session.exec(select(CoverLetter)).all() == []
    assert client.get("/api/applications").json()["total"] == 1


def test_bin_forgets_after_30_days(client, make_application, session: Session):
    job = make_application()
    client.delete(f"/api/applications/{job['id']}")
    row = session.exec(select(RecycledApplication)).one()
    row.deleted_at = utcnow() - timedelta(days=31)
    session.add(row)
    session.commit()
    assert client.get("/api/bin").json() == []
    assert session.exec(select(RecycledApplication)).all() == []


@pytest.fixture
def backups(tmp_path: Path, client) -> Path:
    db = tmp_path / "real.db"
    import sqlite3

    sqlite3.connect(db).close()
    home = tmp_path / "home"
    app.dependency_overrides[get_backup_service] = lambda: BackupService(
        db, tmp_path / "cvs", home, "test"
    )
    return home / "backups"


def test_delete_everything_needs_typing_delete_and_backs_up_first(
    client, make_application, backups: Path, session: Session
):
    for i in range(3):
        make_application(company=f"Company {i}")
    assert client.post("/api/applications/delete-all", json={"confirm": "yes"}).status_code == 422
    assert client.get("/api/applications").json()["total"] == 3

    result = client.post("/api/applications/delete-all", json={"confirm": "DELETE"}).json()
    assert result["deleted"] == 3
    backup = Path(result["backup"])
    assert backup.parent == backups and backup.name.startswith("before-delete-all-")
    assert backup.stat().st_size > 0
    assert client.get("/api/applications").json()["total"] == 0
    assert len(client.get("/api/bin").json()) == 3  # and they can still be restored
    assert session.exec(select(StatusHistory)).all() == []
