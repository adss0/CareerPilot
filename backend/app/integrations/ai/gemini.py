"""Google Gemini via its REST API (free tier key from https://aistudio.google.com/apikey)."""

import json
from typing import Any

import httpx

from app.integrations.ai.base import AIError

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
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
        }
        try:
            response = self._client.post(f"/models/{self.model}:generateContent", json=body)
        except httpx.TimeoutException as exc:
            raise AIError("Gemini took too long to answer. Try again.") from exc
        except httpx.HTTPError as exc:
            raise AIError("Couldn't reach Gemini. Check your internet connection.") from exc

        if response.status_code == 429:
            raise AIError("Gemini's free-tier limit was reached. Wait a minute and try again.")
        if response.status_code in (401, 403):
            raise AIError("Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env.")
        if response.status_code == 404:
            raise AIError(f"Gemini model '{self.model}' wasn't found. Check GEMINI_MODEL.")
        if response.status_code >= 400:
            raise AIError(f"Gemini returned an error ({response.status_code}).")

        try:
            parts = response.json()["candidates"][0]["content"]["parts"]
            data = json.loads("".join(part.get("text", "") for part in parts))
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise AIError("Gemini's answer couldn't be understood. Try again.") from exc
        if not isinstance(data, dict):
            raise AIError("Gemini's answer wasn't in the expected format. Try again.")
        return data
