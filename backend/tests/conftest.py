"""Shared test fixtures.

Every test gets a fresh in-memory database and never reads backend/.env, so tests never touch
a real careerpilot.db or real API keys, and never call a real AI service.
All test data is fake (example.com addresses are reserved for documentation).
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

import app.models  # noqa: F401  (registers tables)
from app.api.deps import (
    get_ai_provider,
    get_ai_settings_service,
    get_cv_storage_dir,
    get_email_queue,
    get_email_service,
    get_email_settings_service,
    get_letter_queue,
)
from app.core.config import Settings
from app.core.db import get_session, make_engine
from app.main import app
from app.services.ai_settings_service import AiSettingsService
from app.services.email_queue import EmailQueue
from app.services.email_service import EmailService
from app.services.email_settings_service import EmailSettingsService
from app.services.letter_queue import LetterQueue


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = make_engine("sqlite://", poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    with Session(engine) as session:
        yield session


@pytest.fixture
def env_settings() -> Settings:
    """App settings for tests: no .env file, no API keys."""
    return Settings(_env_file=None, gemini_api_key="", groq_api_key="", email_password="")


@pytest.fixture
def cv_dir(tmp_path: Path) -> Path:
    return tmp_path / "cvs"


@pytest.fixture
def ai() -> dict:
    """Set ai["provider"] to a fake provider in a test; None means AI isn't set up."""
    return {"provider": None}


@pytest.fixture
def sleeps() -> list[float]:
    """Waits the letter queue would have done (it never really sleeps in tests)."""
    return []


@pytest.fixture
def letter_queue(engine: Engine, ai: dict, sleeps: list[float]) -> LetterQueue:
    return LetterQueue(
        session_factory=lambda: Session(engine),
        ai_factory=lambda _session: ai["provider"],
        gap_factory=lambda _session: 4.0,
        sleep=sleeps.append,
        run_inline=True,
    )


@pytest.fixture
def sent_emails() -> list:
    """Emails the queue 'sent' with the fake sender: (settings, password, message)."""
    return []


@pytest.fixture
def email_queue(
    engine: Engine, env_settings: Settings, cv_dir: Path, sent_emails: list
) -> EmailQueue:
    return EmailQueue(
        session_factory=lambda: Session(engine),
        env=env_settings,
        cv_dir=cv_dir,
        sender=lambda settings, password, message: sent_emails.append(
            (settings, password, message)
        ),
        gap=lambda low, high: high,
    )


@pytest.fixture
def client(
    session: Session,
    cv_dir: Path,
    ai: dict,
    env_settings: Settings,
    letter_queue: LetterQueue,
    email_queue: EmailQueue,
) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_cv_storage_dir] = lambda: cv_dir
    app.dependency_overrides[get_ai_provider] = lambda: ai["provider"]
    app.dependency_overrides[get_ai_settings_service] = lambda: AiSettingsService(
        session, env_settings
    )
    app.dependency_overrides[get_letter_queue] = lambda: letter_queue
    app.dependency_overrides[get_email_settings_service] = lambda: EmailSettingsService(
        session, env_settings
    )
    app.dependency_overrides[get_email_service] = lambda: EmailService(
        session, env_settings, cv_dir
    )
    app.dependency_overrides[get_email_queue] = lambda: email_queue
    # Not used as a context manager, so startup migrations don't run against a real file.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def make_application(client: TestClient):
    def _make(**overrides) -> dict:
        payload = {"company": "Acme Ltd", "role": "Junior Developer", **overrides}
        response = client.post("/api/applications", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make
