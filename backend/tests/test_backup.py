import io
import json
import sqlite3
import zipfile
from contextlib import closing
from pathlib import Path

import pytest

from app.api.backup import get_backup_service
from app.core.db import database_url, run_migrations
from app.core.errors import BadRequestError
from app.main import app
from app.services.backup_service import BackupService

CV = "0123456789abcdef0123456789abcdef.pdf"


@pytest.fixture
def home(tmp_path: Path) -> Path:
    """A real data folder with a migrated database, one job and one CV."""
    run_migrations(database_url(str(tmp_path / "careerpilot.db")))
    with closing(sqlite3.connect(tmp_path / "careerpilot.db")) as db, db:
        db.execute(
            "INSERT INTO application (company, role, job_url, job_description, contact_name, "
            "contact_email, location, salary, source, status, priority, notes, created_at, "
            "updated_at) VALUES ('Acme Ltd', 'Dev', '', '', '', '', '', '', 'manual', "
            "'IMPORTED', 0, '', '2026-01-01', '2026-01-01')"
        )
    (tmp_path / "data" / "cvs").mkdir(parents=True)
    (tmp_path / "data" / "cvs" / CV).write_bytes(b"%PDF fake cv")
    (tmp_path / ".env").write_text("GEMINI_API_KEY=secret-test-key")
    return tmp_path


def service(home: Path) -> BackupService:
    return BackupService(home / "careerpilot.db", home / "data" / "cvs", home, "1.0.0")


def companies(db: Path) -> list[str]:
    with closing(sqlite3.connect(db)) as connection:
        return [r[0] for r in connection.execute("SELECT company FROM application")]


def test_backup_contains_data_but_never_secrets(home):
    content = service(home).create()
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        names = set(archive.namelist())
        manifest = json.loads(archive.read("manifest.json"))
        assert b"secret-test-key" not in b"".join(archive.read(n) for n in names)
    assert names == {"manifest.json", "careerpilot.db", f"cvs/{CV}"}
    assert manifest["app"] == "CareerPilot"
    assert manifest["cvs"] == 1


def test_restore_is_staged_then_applied_safely(home, tmp_path_factory):
    backup = service(home).create()

    # Change the data after the backup was made
    with closing(sqlite3.connect(home / "careerpilot.db")) as db, db:
        db.execute("UPDATE application SET company = 'Changed'")
    (home / "data" / "cvs" / CV).unlink()

    staged = service(home).stage(backup)
    assert staged["cvs"] == 1
    assert service(home).pending() is not None
    assert companies(home / "careerpilot.db") == ["Changed"]  # nothing replaced yet

    assert service(home).apply_pending() is True
    assert companies(home / "careerpilot.db") == ["Acme Ltd"]
    assert (home / "data" / "cvs" / CV).read_bytes() == b"%PDF fake cv"
    assert service(home).pending() is None
    # The data from before the restore was kept, not deleted
    (kept,) = (home / "backups").iterdir()
    assert companies(kept / "careerpilot.db") == ["Changed"]
    assert service(home).apply_pending() is False


def make_zip(files: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return buffer.getvalue()


MANIFEST = json.dumps({"app": "CareerPilot"}).encode()


@pytest.mark.parametrize(
    ("files", "message"),
    [
        ({"manifest.json": MANIFEST, "careerpilot.db": b"x", "../../evil.txt": b"x"}, "changed"),
        ({"manifest.json": MANIFEST, "careerpilot.db": b"x", "cvs/../../x.pdf": b"x"}, "changed"),
        ({"manifest.json": MANIFEST}, "isn't a CareerPilot backup"),
        ({"manifest.json": b'{"app": "Other"}', "careerpilot.db": b"x"}, "isn't a CareerPilot"),
        ({"manifest.json": MANIFEST, "careerpilot.db": b"not a database"}, "damaged"),
    ],
)
def test_restore_rejects_bad_or_tampered_backups(home, files, message):
    with pytest.raises(BadRequestError, match=message):
        service(home).stage(make_zip(files))
    assert service(home).pending() is None
    assert companies(home / "careerpilot.db") == ["Acme Ltd"]


def test_restore_rejects_non_zip(home):
    with pytest.raises(BadRequestError, match=".zip"):
        service(home).stage(b"hello")


def test_backup_api(client, home):
    app.dependency_overrides[get_backup_service] = lambda: service(home)
    download = client.get("/api/backup")
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/zip"
    assert "careerpilot-backup-" in download.headers["content-disposition"]

    staged = client.post(
        "/api/restore", files={"file": ("b.zip", download.content, "application/zip")}
    )
    assert staged.status_code == 202
    assert "Restart CareerPilot" in staged.json()["message"]
    assert client.get("/api/restore").json()["pending"]["app"] == "CareerPilot"
    assert client.delete("/api/restore").status_code == 204
    assert client.get("/api/restore").json()["pending"] is None
