"""Google Gemini via its REST API (free tier key from https://aistudio.google.com/apikey)."""

from typing import Any

import httpx

from app.integrations.ai.base import AIError, parse_json_text, post_json

API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout: float = 60,
        transport: httpx.BaseTransport | None = None,
    ):
        self.model = model
        # The key goes in a header, never in the URL, so it can't end up in logs.
        self._client = httpx.Client(
            base_url=API_BASE,
            headers={"x-goog-api-key": api_key},
            timeout=timeout,
            transport=transport,
        )

    def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4},
        }
        data = post_json(
            self._client,
            f"/models/{self.model}:generateContent",
            body,
            label="Gemini",
            key_hint="GEMINI_API_KEY",
            model=self.model,
        )
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(part.get("text", "") for part in parts)
        except (KeyError, IndexError, TypeError) as exc:
            raise AIError("Gemini's answer couldn't be understood. Try again.") from exc
        return parse_json_text(text, "Gemini")
