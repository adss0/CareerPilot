from typing import Any, Protocol


class AIError(RuntimeError):
    """The AI call failed; the message is safe to show to the user."""


class AIProvider(Protocol):
    name: str
    model: str

    def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        """Returns the model's reply parsed as a JSON object, or raises AIError."""
        ...
