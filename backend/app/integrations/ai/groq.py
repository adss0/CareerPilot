"""Groq's OpenAI-compatible API (free tier key from https://console.groq.com/keys)."""

from typing import Any

import httpx

from app.integrations.ai.base import AIError, parse_json_text, post_json

API_BASE = "https://api.groq.com/openai/v1"


class GroqProvider:
    name = "groq"

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout: float = 60,
        transport: httpx.BaseTransport | None = None,
    ):
        self.model = model
        self._client = httpx.Client(
            base_url=API_BASE,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
            transport=transport,
        )

    def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
        }
        data = post_json(
            self._client,
            "/chat/completions",
            body,
            label="Groq",
            key_hint="GROQ_API_KEY",
            model=self.model,
        )
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIError("Groq's answer couldn't be understood. Try again.") from exc
        return parse_json_text(text or "", "Groq")
