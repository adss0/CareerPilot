"""Shared test fixtures.

Every test gets a fresh in-memory database, so tests never touch a real careerpilot.db.
All test data is fake (example.com addresses are reserved for documentation).
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

import app.models  # noqa: F401  (registers tables)
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
def client(session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: session
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
