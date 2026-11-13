"""Gemini: when a model is busy, too slow or retired, the next model is tried."""

import json

import httpx
import pytest

from app.core.config import Settings
from app.integrations.ai import AIError, AIRateLimitError, build_ai_provider
from app.integrations.ai.gemini import GeminiProvider

OK = {"candidates": [{"content": {"parts": [{"text": json.dumps({"ok": True})}]}}]}


def provider(answers: dict[str, object], fallbacks=("lite",)) -> tuple[GeminiProvider, list]:
    """answers: model -> HTTP status, or "timeout"."""
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = request.url.path.split("/models/")[1].split(":")[0]
        calls.append(model)
        answer = answers[model]
        if answer == "timeout":
            raise httpx.ReadTimeout("slow", request=request)
        return httpx.Response(answer, json=OK if answer == 200 else {})

    gemini = GeminiProvider(
        "key", "main", transport=httpx.MockTransport(handler), fallback_models=fallbacks
    )
    return gemini, calls


@pytest.mark.parametrize("problem", [503, 500, 404, 429, "timeout"])
def test_falls_back_when_the_main_model_cant_answer(problem):
    gemini, calls = provider({"main": problem, "lite": 200})
    assert gemini.generate_json("system", "prompt") == {"ok": True}
    assert calls == ["main", "lite"]
    assert gemini.model == "lite"  # what the letter records as "written by"


def test_uses_the_main_model_when_it_works():
    gemini, calls = provider({"main": 200, "lite": 200})
    gemini.generate_json("s", "p")
    assert calls == ["main"] and gemini.model == "main"


def test_a_bad_key_never_falls_back():
    gemini, calls = provider({"main": 403, "lite": 200})
    with pytest.raises(AIError, match="rejected the API key"):
        gemini.generate_json("s", "p")
    assert calls == ["main"]


def test_when_every_model_is_busy_the_last_error_is_shown():
    gemini, calls = provider({"main": 503, "lite": 429})
    with pytest.raises(AIRateLimitError):
        gemini.generate_json("s", "p")
    assert calls == ["main", "lite"]
    gemini, _ = provider({"main": 503, "lite": 503})
    with pytest.raises(AIError, match="busy right now"):
        gemini.generate_json("s", "p")


def test_fallbacks_come_from_settings_without_duplicates():
    settings = Settings(
        _env_file=None,
        gemini_api_key="key",
        gemini_fallback_models=" lite , other,lite,",
    )
    gemini = build_ai_provider(settings, "gemini", "other")
    assert gemini.model == "other"
    assert gemini.fallbacks == ("lite",)  # the main model isn't tried twice
    default = Settings(_env_file=None, gemini_api_key="key")
    assert default.gemini_model == "gemini-3-flash-preview"
    assert build_ai_provider(default, "gemini", default.gemini_model).fallbacks == (
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
    )
