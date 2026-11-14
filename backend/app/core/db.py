import sqlite3
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, event
from sqlmodel import Session, create_engine

from app.core.config import BACKEND_DIR, get_settings


def database_url(db_path: str) -> str:
    return f"sqlite:///{db_path}"


def make_engine(url: str, **kwargs) -> Engine:
    engine = create_engine(url, connect_args={"check_same_thread": False}, **kwargs)

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record) -> None:
        # SQLite ignores foreign keys (and ON DELETE CASCADE) unless this is on.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@lru_cache
def get_engine() -> Engine:
    return make_engine(database_url(str(get_settings().db_file)))


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session


def _alembic_config(url: str | None = None) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", url or database_url(str(get_settings().db_file)))
    return config


def run_migrations(url: str | None = None, revision: str = "head") -> None:
    """Bring the database schema up to date (creates the file on first run)."""
    command.upgrade(_alembic_config(url), revision)


def needs_upgrade(db_file: Path) -> bool:
    """True when an existing database is from an older version of the app."""
    if not db_file.exists():
        return False
    head = ScriptDirectory.from_config(_alembic_config()).get_current_head()
    connection = sqlite3.connect(db_file)
    try:
        row = connection.execute("SELECT version_num FROM alembic_version").fetchone()
    except sqlite3.Error:
        return False  # not a CareerPilot database yet: nothing to protect
    finally:
        connection.close()
    return row is not None and row[0] != head
