"""Google Gemini via its REST API (free tier key from https://aistudio.google.com/apikey)."""

from typing import Any

import httpx

from app.integrations.ai.base import (
    AIError,
    AIModelUnavailableError,
    AIRateLimitError,
    parse_json_text,
    post_json,
)

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
FIRST_TRY_TIMEOUT = 30


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout: float = 60,
        transport: httpx.BaseTransport | None = None,
        fallback_models: tuple[str, ...] = (),
    ):
        self.model = model
        # Tried in order when a model is busy, too slow or retired (Google does all three).
        self.fallbacks = tuple(m for m in dict.fromkeys(fallback_models) if m and m != model)
        self.timeout = timeout
        # The key goes in a header, never in the URL, so it can't end up in logs.
        self._client = httpx.Client(
            base_url=API_BASE,
            headers={"x-goog-api-key": api_key},
            timeout=timeout,
            transport=transport,
        )

    def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        models = (self.model, *self.fallbacks)
        for index, model in enumerate(models):
            last = index == len(models) - 1
            try:
                # Don't wait the full time on a stalled model when there's another to try.
                timeout = self.timeout if last else min(self.timeout, FIRST_TRY_TIMEOUT)
                result = self._generate(model, system, prompt, timeout)
            except (AIModelUnavailableError, AIRateLimitError):
                if last:
                    raise
                continue
            self.model = model  # record the model that actually answered
            return result
        raise AIError("Gemini couldn't answer. Try again.")  # pragma: no cover

    def _generate(self, model: str, system: str, prompt: str, timeout: float) -> dict[str, Any]:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4},
        }
        data = post_json(
            self._client,
            f"/models/{model}:generateContent",
            body,
            label="Gemini",
            key_hint="GEMINI_API_KEY",
            model=model,
            timeout=timeout,
        )
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(part.get("text", "") for part in parts)
        except (KeyError, IndexError, TypeError) as exc:
            raise AIError("Gemini's answer couldn't be understood. Try again.") from exc
        return parse_json_text(text, "Gemini")
