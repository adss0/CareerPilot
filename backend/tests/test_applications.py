from sqlmodel import Session, select

from app.models import StatusHistory


def test_create_and_get_application(client, make_application):
    created = make_application(
        contact_email="hiring@example.com",
        job_url="https://example.com/jobs/1",
        priority=2,
    )

    assert created["id"] > 0
    assert created["status"] == "imported"
    assert created["contact_email"] == "hiring@example.com"
    assert created["applied_at"] is None

    response = client.get(f"/api/applications/{created['id']}")
    assert response.status_code == 200
    assert response.json()["company"] == "Acme Ltd"


def test_create_rejects_invalid_input(client):
    assert client.post("/api/applications", json={"role": "Dev"}).status_code == 422
    assert (
        client.post(
            "/api/applications",
            json={"company": "Acme Ltd", "role": "Dev", "contact_email": "not-an-email"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/applications", json={"company": "Acme Ltd", "role": "Dev", "priority": 9}
        ).status_code
        == 422
    )


def test_blank_contact_email_is_allowed(make_application):
    assert make_application(contact_email="")["contact_email"] == ""


def test_list_filters_search_and_paginates(client, make_application):
    make_application(company="Acme Ltd", role="Backend Developer")
    make_application(company="Globex", role="Data Analyst", status="sent")
    make_application(company="Initech", role="Frontend Developer")

    everything = client.get("/api/applications").json()
    assert everything["total"] == 3

    sent = client.get("/api/applications", params={"status": "sent"}).json()
    assert [a["company"] for a in sent["items"]] == ["Globex"]

    developers = client.get("/api/applications", params={"search": "developer"}).json()
    assert developers["total"] == 2

    page = client.get("/api/applications", params={"limit": 1, "offset": 1}).json()
    assert len(page["items"]) == 1
    assert page["total"] == 3


def test_update_changes_only_sent_fields(client, make_application):
    created = make_application(notes="first note")

    response = client.patch(f"/api/applications/{created['id']}", json={"notes": "updated"})
    assert response.status_code == 200
    body = response.json()
    assert body["notes"] == "updated"
    assert body["company"] == "Acme Ltd"


def test_update_ignores_null_for_required_fields(client, make_application):
    created = make_application()

    response = client.patch(
        f"/api/applications/{created['id']}", json={"company": None, "status": None}
    )
    assert response.status_code == 200
    assert response.json()["company"] == "Acme Ltd"
    assert response.json()["status"] == "imported"


def test_status_change_records_history_and_sets_applied_at(client, make_application):
    created = make_application()
    app_id = created["id"]

    client.patch(f"/api/applications/{app_id}", json={"status": "drafted"})
    sent = client.patch(f"/api/applications/{app_id}", json={"status": "sent"}).json()
    assert sent["applied_at"] is not None

    history = client.get(f"/api/applications/{app_id}/history").json()
    assert [(h["from_status"], h["to_status"]) for h in history] == [
        (None, "imported"),
        ("imported", "drafted"),
        ("drafted", "sent"),
    ]


def test_same_status_does_not_add_history(client, make_application):
    created = make_application()
    client.patch(f"/api/applications/{created['id']}", json={"status": "imported"})

    history = client.get(f"/api/applications/{created['id']}/history").json()
    assert len(history) == 1


def test_delete_removes_application_and_its_history(client, session: Session, make_application):
    created = make_application()
    client.patch(f"/api/applications/{created['id']}", json={"status": "ready"})

    assert client.delete(f"/api/applications/{created['id']}").status_code == 204
    assert client.get(f"/api/applications/{created['id']}").status_code == 404
    assert session.exec(select(StatusHistory)).all() == []


def test_missing_application_returns_404(client):
    assert client.get("/api/applications/999").status_code == 404
    assert client.patch("/api/applications/999", json={"notes": "x"}).status_code == 404
    assert client.delete("/api/applications/999").status_code == 404
    assert client.get("/api/applications/999/history").status_code == 404
