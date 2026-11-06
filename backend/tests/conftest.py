"""Shared test fixtures.

Every test gets a fresh in-memory database, so tests never touch a real careerpilot.db.
All test data is fake (example.com addresses are reserved for documentation).
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

import app.models  # noqa: F401  (registers tables)
from app.api.deps import get_ai_provider, get_cv_storage_dir
from app.core.db import get_session, make_engine
from app.main import app


@pytest.fixture
def session() -> Iterator[Session]:
    engine = make_engine("sqlite://", poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def cv_dir(tmp_path: Path) -> Path:
    return tmp_path / "cvs"


@pytest.fixture
def ai() -> dict:
    """Set ai["provider"] to a fake provider in a test; None means AI isn't set up."""
    return {"provider": None}


@pytest.fixture
def client(session: Session, cv_dir: Path, ai: dict) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_cv_storage_dir] = lambda: cv_dir
    app.dependency_overrides[get_ai_provider] = lambda: ai["provider"]
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
