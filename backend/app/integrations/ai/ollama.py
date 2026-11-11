"""Ollama: AI models running on your own computer (https://ollama.com). Free and offline."""

from typing import Any

import httpx

from app.integrations.ai.base import AIError, parse_json_text


class OllamaProvider:
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout: float = 180,  # local models can be slow on a laptop
        transport: httpx.BaseTransport | None = None,
    ):
        self.model = model
        self._client = httpx.Client(base_url=base_url, timeout=timeout, transport=transport)

    def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.4},
        }
        try:
            response = self._client.post("/api/chat", json=body)
        except httpx.TimeoutException as exc:
            raise AIError("Ollama took too long. Try a smaller model.") from exc
        except httpx.HTTPError as exc:
            raise AIError("Ollama isn't running. Install it from ollama.com and start it.") from exc

        if response.status_code == 404:
            raise AIError(
                f"Ollama doesn't have the model '{self.model}'. Run: ollama pull {self.model}"
            )
        if response.status_code >= 400:
            raise AIError(f"Ollama returned an error ({response.status_code}).")
        try:
            text = response.json()["message"]["content"]
        except (KeyError, TypeError, ValueError) as exc:
            raise AIError("Ollama's answer couldn't be understood. Try again.") from exc
        return parse_json_text(text, "Ollama")
