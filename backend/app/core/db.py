from collections.abc import Iterator
from functools import lru_cache

from alembic import command
from alembic.config import Config
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


def run_migrations(url: str | None = None, revision: str = "head") -> None:
    """Bring the database schema up to date (creates the file on first run)."""
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", url or database_url(str(get_settings().db_file)))
    command.upgrade(config, revision)
