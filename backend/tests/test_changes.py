"""The value the app's windows poll to know when to refresh."""

from sqlmodel import Session, update

from app.models import Application


def version(client) -> str:
    return client.get("/api/changes").json()["version"]


def test_saving_moves_the_version(client):
    before = version(client)
    assert version(client) == before  # reading changes nothing
    created = client.post("/api/applications", json={"company": "Acme Ltd", "role": "Dev"})
    assert created.status_code == 201
    after_add = version(client)
    assert after_add != before
    client.patch(f"/api/applications/{created.json()['id']}", json={"notes": "Called back"})
    assert version(client) != after_add


def test_a_failed_save_doesnt_move_it(client):
    before = version(client)
    assert client.post("/api/applications", json={"role": "Dev"}).status_code == 422
    assert version(client) == before


def test_writes_outside_a_request_count_too(client, engine):
    # The background email and reply jobs open their own sessions.
    before = version(client)
    with Session(engine) as session:
        session.add(Application(company="Acme Ltd", role="Dev"))
        session.commit()
    after_add = version(client)
    assert after_add != before
    with Session(engine) as session:
        session.exec(update(Application).values(notes="Bulk"))  # skips the flush
        session.commit()
    assert version(client) != after_add


def test_a_rolled_back_change_doesnt_count(client, engine):
    before = version(client)
    with Session(engine) as session:
        session.add(Application(company="Acme Ltd", role="Dev"))
        session.flush()
        session.rollback()
        session.commit()  # nothing left to save
    assert version(client) == before
