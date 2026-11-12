"""Backup (download everything as a .zip) and restore (staged, applied on the next start).

A backup holds the database and your CVs. It never contains .env (API keys, email password).
A restore is checked carefully and staged; on the next start the current data is moved to
backups/ first, then the backup is put in place. Nothing is ever deleted.
"""

import io
import json
import re
import shutil
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from app.core.errors import BadRequestError

DB_NAME = "careerpilot.db"
STAGING = "restore-pending"
READY = "READY"
CV_NAME_RE = re.compile(r"^cvs/[0-9a-f]{32}\.(pdf|docx|txt)$")
MAX_BACKUP_BYTES = 500 * 1024 * 1024
MAX_UNPACKED_BYTES = 2 * 1024 * 1024 * 1024  # protects against "zip bombs"


class BackupService:
    def __init__(self, db_file: Path, cv_dir: Path, home: Path, version: str):
        self.db_file = db_file
        self.cv_dir = cv_dir
        self.home = home
        self.version = version

    # ---------- backup ----------

    def create(self) -> bytes:
        buffer = io.BytesIO()
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / DB_NAME
            # SQLite's backup API: a consistent copy even while the app is running.
            source = sqlite3.connect(self.db_file)
            target = sqlite3.connect(copy)
            try:
                source.backup(target)
            finally:
                target.close()
                source.close()

            cvs = sorted(self.cv_dir.glob("*")) if self.cv_dir.is_dir() else []
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(
                    "manifest.json",
                    json.dumps(
                        {
                            "app": "CareerPilot",
                            "version": self.version,
                            "created_at": datetime.now(UTC).isoformat(),
                            "cvs": len(cvs),
                            "note": "Your database and CVs. API keys (.env) are not included.",
                        },
                        indent=2,
                    ),
                )
                archive.write(copy, DB_NAME)
                for cv in cvs:
                    if CV_NAME_RE.fullmatch(f"cvs/{cv.name}"):
                        archive.write(cv, f"cvs/{cv.name}")
        return buffer.getvalue()

    # ---------- restore ----------

    def stage(self, content: bytes) -> dict:
        if len(content) > MAX_BACKUP_BYTES:
            raise BadRequestError("This backup is too large (over 500 MB).")
        try:
            archive = zipfile.ZipFile(io.BytesIO(content))
        except zipfile.BadZipFile as exc:
            raise BadRequestError("This isn't a CareerPilot backup (.zip) file.") from exc

        with archive:
            names = archive.namelist()
            # Only names we create ourselves: blocks "../" paths and anything unexpected.
            unexpected = [
                n
                for n in names
                if n not in ("manifest.json", DB_NAME) and not CV_NAME_RE.fullmatch(n)
            ]
            if unexpected or DB_NAME not in names or "manifest.json" not in names:
                raise BadRequestError("This isn't a CareerPilot backup, or it has been changed.")
            if sum(info.file_size for info in archive.infolist()) > MAX_UNPACKED_BYTES:
                raise BadRequestError("This backup is too large to restore.")
            try:
                manifest = json.loads(archive.read("manifest.json"))
            except ValueError as exc:
                raise BadRequestError("The backup's manifest is damaged.") from exc
            if manifest.get("app") != "CareerPilot":
                raise BadRequestError("This isn't a CareerPilot backup.")

            staging = self.home / STAGING
            shutil.rmtree(staging, ignore_errors=True)
            (staging / "cvs").mkdir(parents=True)
            for name in names:
                if name != "manifest.json":
                    (staging / name).write_bytes(archive.read(name))

        try:
            self._check_database(staging / DB_NAME)
        except BadRequestError:
            shutil.rmtree(staging, ignore_errors=True)
            raise
        (staging / READY).write_text(json.dumps(manifest))
        return {
            "cvs": sum(1 for n in names if n.startswith("cvs/")),
            "created_at": manifest.get("created_at"),
        }

    @staticmethod
    def _check_database(path: Path) -> None:
        try:
            # closing(): "with sqlite3.connect()" alone leaves the file open (and locked on Windows)
            with closing(sqlite3.connect(f"file:{path}?mode=ro", uri=True)) as connection:
                ok = connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
                tables = {r[0] for r in connection.execute("SELECT name FROM sqlite_master")}
        except sqlite3.DatabaseError as exc:
            raise BadRequestError("The database in this backup is damaged.") from exc
        if not ok or not {"application", "alembic_version"} <= tables:
            raise BadRequestError("The database in this backup is damaged or not from CareerPilot.")

    def pending(self) -> dict | None:
        marker = self.home / STAGING / READY
        return json.loads(marker.read_text()) if marker.is_file() else None

    def cancel(self) -> None:
        shutil.rmtree(self.home / STAGING, ignore_errors=True)

    def apply_pending(self) -> bool:
        """Runs at start-up, before the database opens. True if a backup was restored."""
        staging = self.home / STAGING
        if not (staging / READY).is_file():
            return False
        stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        safety = self.home / "backups" / f"before-restore-{stamp}"
        safety.mkdir(parents=True, exist_ok=True)
        if self.db_file.exists():
            shutil.move(str(self.db_file), safety / DB_NAME)
        if self.cv_dir.exists():
            shutil.move(str(self.cv_dir), safety / "cvs")
        self.db_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(staging / DB_NAME), self.db_file)
        self.cv_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(staging / "cvs"), self.cv_dir)
        shutil.rmtree(staging, ignore_errors=True)
        return True
