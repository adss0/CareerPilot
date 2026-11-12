import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def bare(client) -> TestClient:
    """A client WITHOUT the X-CareerPilot header (like a request from another website)."""
    return TestClient(app)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/applications"),
        ("put", "/api/profile"),
        ("patch", "/api/applications/1"),
        ("delete", "/api/applications/1"),
        ("post", "/api/cvs"),
        ("post", "/api/imports/commit"),
    ],
)
def test_changes_need_the_careerpilot_header(bare, method, path):
    response = getattr(bare, method)(path)
    assert response.status_code == 403
    assert "X-CareerPilot" in response.json()["detail"]


def test_cross_site_form_upload_is_blocked(bare):
    # The classic attack: a hidden form on another site posting a file to localhost.
    response = bare.post("/api/cvs", files={"file": ("cv.txt", b"x", "text/plain")})
    assert response.status_code == 403


def test_reading_works_without_the_header(bare):
    assert bare.get("/api/health").status_code == 200
    assert bare.get("/api/applications").status_code == 200


def test_requests_for_other_hosts_are_refused(client):
    # DNS rebinding: evil.example resolving to 127.0.0.1 still sends "Host: evil.example".
    response = client.get("/api/applications", headers={"Host": "evil.example:8000"})
    assert response.status_code == 400
    for host in ("localhost:8000", "127.0.0.1:8765", "[::1]:8000", "tauri.localhost"):
        assert client.get("/api/health", headers={"Host": host}).status_code == 200


def test_security_headers(client):
    headers = client.get("/api/health").headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "no-referrer"


def test_cors_only_for_known_origins(bare):
    preflight = {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-careerpilot",
    }
    allowed = bare.options(
        "/api/applications", headers={"Origin": "http://localhost:5173", **preflight}
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "x-careerpilot" in allowed.headers.get("access-control-allow-headers", "").lower()

    evil = bare.options(
        "/api/applications", headers={"Origin": "https://evil.example", **preflight}
    )
    assert "access-control-allow-origin" not in evil.headers
