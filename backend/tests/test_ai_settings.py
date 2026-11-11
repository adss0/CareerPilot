from tests.test_ai import FakeAI


def test_defaults_come_from_env_settings(client):
    body = client.get("/api/settings/ai").json()
    assert body["provider"] == "gemini"
    assert body["model"] == "gemini-flash-latest"
    assert body["request_gap_seconds"] == 4
    providers = {p["name"]: p for p in body["providers"]}
    assert providers["gemini"]["configured"] is False  # no key in tests
    assert providers["groq"]["default_model"] == "llama-3.3-70b-versatile"
    assert providers["ollama"]["configured"] is True
    assert "Nothing leaves your machine" in providers["ollama"]["privacy"]


def test_choose_provider_and_model(client):
    body = client.put(
        "/api/settings/ai",
        json={"provider": "ollama", "model": "qwen2.5:7b", "request_gap_seconds": 0},
    ).json()
    assert body["provider"] == "ollama"
    assert body["model"] == "qwen2.5:7b"
    assert body["request_gap_seconds"] == 0

    # Each provider remembers its own model; "" goes back to the default.
    client.put("/api/settings/ai", json={"provider": "groq"})
    assert client.get("/api/settings/ai").json()["model"] == "llama-3.3-70b-versatile"
    client.put("/api/settings/ai", json={"provider": "ollama", "model": ""})
    assert client.get("/api/settings/ai").json()["model"] == "llama3.2"


def test_rejects_bad_settings(client):
    assert client.put("/api/settings/ai", json={"provider": "openai"}).status_code == 422
    assert client.put("/api/settings/ai", json={"request_gap_seconds": -1}).status_code == 422
    bad_model = client.put("/api/settings/ai", json={"model": "llama; rm -rf /"})
    assert bad_model.status_code == 400


def test_connection_test(client, ai):
    not_set_up = client.post("/api/settings/ai/test").json()
    assert not_set_up["ok"] is False
    assert "isn't set up" in not_set_up["message"]

    ai["provider"] = FakeAI({"ok": True})
    assert client.post("/api/settings/ai/test").json()["ok"] is True

    ai["provider"] = FakeAI(error="Gemini rejected the API key.")
    failed = client.post("/api/settings/ai/test").json()
    assert failed["ok"] is False
    assert "rejected the API key" in failed["message"]
