import json

import httpx
import pytest

from app.integrations.ai import AIError, AIRateLimitError
from app.integrations.ai.base import parse_json_text
from app.integrations.ai.gemini import GeminiProvider
from app.integrations.ai.groq import GroqProvider
from app.integrations.ai.ollama import OllamaProvider


def test_groq_sends_bearer_key_and_parses_json():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"ok": true}'}}]})

    groq = GroqProvider("test-key", "llama-test", transport=httpx.MockTransport(handler))
    assert groq.generate_json("sys", "prompt") == {"ok": True}
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["auth"] == "Bearer test-key"
    assert seen["body"]["model"] == "llama-test"
    assert seen["body"]["response_format"] == {"type": "json_object"}
    assert seen["body"]["messages"][0] == {"role": "system", "content": "sys"}


@pytest.mark.parametrize(
    "provider",
    [
        lambda t: GeminiProvider("k", "m", transport=t),
        lambda t: GroqProvider("k", "m", transport=t),
    ],
)
def test_rate_limits_raise_retryable_error(provider):
    transport = httpx.MockTransport(lambda request: httpx.Response(429, json={}))
    with pytest.raises(AIRateLimitError, match="free-tier limit"):
        provider(transport).generate_json("sys", "prompt")


def test_ollama_runs_locally_and_parses_json():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"message": {"content": '{"letter": "Hi"}'}})

    ollama = OllamaProvider(
        "http://localhost:11434", "llama3.2", transport=httpx.MockTransport(handler)
    )
    assert ollama.generate_json("sys", "prompt") == {"letter": "Hi"}
    assert seen["url"] == "http://localhost:11434/api/chat"
    assert seen["body"]["format"] == "json"
    assert seen["body"]["stream"] is False


def test_ollama_errors_explain_what_to_do():
    def offline(request):
        raise httpx.ConnectError("refused")

    with pytest.raises(AIError, match="Ollama isn't running"):
        OllamaProvider("http://x", "m", transport=httpx.MockTransport(offline)).generate_json(
            "s", "p"
        )

    missing = httpx.MockTransport(lambda request: httpx.Response(404, json={}))
    with pytest.raises(AIError, match="ollama pull llama3.2"):
        OllamaProvider("http://x", "llama3.2", transport=missing).generate_json("s", "p")


def test_parse_json_text_handles_code_fences_and_rejects_non_objects():
    assert parse_json_text('```json\n{"a": 1}\n```', "X") == {"a": 1}
    with pytest.raises(AIError, match="expected format"):
        parse_json_text("[1, 2]", "X")
    with pytest.raises(AIError, match="couldn't be understood"):
        parse_json_text("not json", "X")
