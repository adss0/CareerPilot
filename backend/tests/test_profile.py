def test_profile_starts_empty(client):
    response = client.get("/api/profile")
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == ""
    assert body["skills"] == []
    assert body["has_cv"] is False


def test_update_profile(client):
    response = client.put(
        "/api/profile",
        json={
            "full_name": "Jane Example",
            "email": "jane@example.com",
            "skills": [" Python ", "React", ""],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Jane Example"
    assert body["skills"] == ["Python", "React"]

    # Partial update keeps the other fields
    body = client.put("/api/profile", json={"location": "London"}).json()
    assert body["location"] == "London"
    assert body["full_name"] == "Jane Example"


def test_profile_rejects_invalid_email(client):
    assert client.put("/api/profile", json={"email": "nope"}).status_code == 422


def test_profile_never_exposes_cv_text(client):
    assert "cv_text" not in client.get("/api/profile").json()
