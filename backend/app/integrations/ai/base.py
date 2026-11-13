import json
from typing import Any, Protocol

import httpx


class AIError(RuntimeError):
    """The AI call failed; the message is safe to show to the user."""


class AIRateLimitError(AIError):
    """The provider's (free-tier) rate limit was hit; waiting and retrying may work."""


class AIModelUnavailableError(AIError):
    """This model is busy, too slow, or retired right now; another model may still work."""


class AIProvider(Protocol):
    name: str
    model: str

    def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        """Returns the model's reply parsed as a JSON object, or raises AIError."""
        ...


def post_json(
    client: httpx.Client,
    url: str,
    body: dict,
    *,
    label: str,
    key_hint: str,
    model: str,
    timeout: float | None = None,
) -> dict:
    """POSTs to an AI API and turns HTTP problems into friendly AIErrors."""
    try:
        if timeout is None:
            response = client.post(url, json=body)
        else:
            response = client.post(url, json=body, timeout=timeout)
    except httpx.TimeoutException as exc:
        raise AIModelUnavailableError(
            f"{label} took too long to answer. Try again in a minute."
        ) from exc
    except httpx.HTTPError as exc:
        raise AIError(f"Couldn't reach {label}. Check your internet connection.") from exc

    if response.status_code == 429:
        raise AIRateLimitError(
            f"{label}'s free-tier limit was reached. Wait a minute and try again."
        )
    if response.status_code in (401, 403):
        raise AIError(f"{label} rejected the API key. Paste it again in Settings.")
    if response.status_code == 404:
        raise AIModelUnavailableError(
            f"{label} model '{model}' wasn't found. Check the model name in Settings."
        )
    if response.status_code >= 500:
        raise AIModelUnavailableError(
            f"{label} is busy right now (its servers are overloaded). Try again in a minute."
        )
    if response.status_code >= 400:
        raise AIError(f"{label} returned an error ({response.status_code}).")
    try:
        return response.json()
    except ValueError as exc:
        raise AIError(f"{label}'s answer couldn't be understood. Try again.") from exc


def parse_json_text(text: str, label: str) -> dict[str, Any]:
    """Parses the model's text as a JSON object (tolerating ```json fences)."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(text)
    except ValueError as exc:
        raise AIError(f"{label}'s answer couldn't be understood. Try again.") from exc
    if not isinstance(data, dict):
        raise AIError(f"{label}'s answer wasn't in the expected format. Try again.")
    return data
