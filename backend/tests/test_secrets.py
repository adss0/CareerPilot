from pathlib import Path

import pytest

from app.api.deps import get_secrets_service
from app.core.config import Settings
from app.main import app
from app.services.secrets_service import SecretsService


@pytest.fixture
def env_file(tmp_path: Path, client, env_settings: Settings) -> Path:
    path = tmp_path / ".env"
    path.write_text("# my settings\nAI_PROVIDER=gemini\nGEMINI_API_KEY=\nDB_PATH=x.db\n")
    app.dependency_overrides[get_secrets_service] = lambda: SecretsService(env_settings, path)
    return path


def test_saves_a_key_to_env_without_ever_returning_it(client, env_file: Path, env_settings):
    assert client.get("/api/settings/secrets").json() == {
        "gemini": False,
        "groq": False,
        "email": False,
        "reed": False,
        "adzuna_id": False,
        "adzuna_key": False,
    }
    response = client.put("/api/settings/secrets/gemini", json={"value": "  AIza-test-key_123 "})
    assert response.status_code == 200
    assert response.json()["gemini"] is True
    assert "AIza" not in response.text
    assert env_file.read_text() == (
        "# my settings\nAI_PROVIDER=gemini\nGEMINI_API_KEY=AIza-test-key_123\nDB_PATH=x.db\n"
    )
    assert env_settings.gemini_api_key == "AIza-test-key_123"  # used straight away
    # The AI settings page now shows Gemini as set up.
    providers = client.get("/api/settings/ai").json()["providers"]
    assert next(p for p in providers if p["name"] == "gemini")["configured"] is True


def test_adds_missing_lines_and_removes_keys(client, env_file: Path, env_settings):
    client.put("/api/settings/secrets/email", json={"value": "abcd efgh ijkl mnop"})
    assert env_file.read_text().endswith("EMAIL_PASSWORD=abcdefghijklmnop\n")
    assert env_settings.email_password == "abcdefghijklmnop"

    client.put("/api/settings/secrets/email", json={"value": ""})
    assert "EMAIL_PASSWORD=\n" in env_file.read_text()
    assert client.get("/api/settings/secrets").json()["email"] is False


@pytest.mark.parametrize("value", ["two words", 'quo"te', "line\nbreak", "x" * 501])
def test_rejects_values_that_could_break_the_env_file(client, env_file: Path, value):
    response = client.put("/api/settings/secrets/groq", json={"value": value})
    assert response.status_code in (400, 422)
    assert "GROQ" not in env_file.read_text()


def test_unknown_secret_is_rejected(client, env_file: Path):
    assert client.put("/api/settings/secrets/other", json={"value": "x"}).status_code == 422
