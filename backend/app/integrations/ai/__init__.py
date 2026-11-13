from dataclasses import dataclass

from app.core.config import Settings
from app.integrations.ai.base import AIError, AIProvider, AIRateLimitError
from app.integrations.ai.gemini import GeminiProvider
from app.integrations.ai.groq import GroqProvider
from app.integrations.ai.ollama import OllamaProvider

__all__ = [
    "PROVIDERS",
    "AIError",
    "AIProvider",
    "AIRateLimitError",
    "ProviderInfo",
    "build_ai_provider",
    "default_model",
    "is_configured",
]


@dataclass(frozen=True)
class ProviderInfo:
    name: str
    label: str
    setup: str  # how to set it up, shown in Settings
    privacy: str  # where your data goes, shown in Settings


PROVIDERS: dict[str, ProviderInfo] = {
    "gemini": ProviderInfo(
        "gemini",
        "Google Gemini",
        "Free key from https://aistudio.google.com/apikey → paste it in Keys & passwords",
        "Sends your text to Google. On the free tier, Google may use it to improve its products.",
    ),
    "groq": ProviderInfo(
        "groq",
        "Groq",
        "Free key from https://console.groq.com/keys → paste it in Keys & passwords",
        "Sends your text to Groq's servers.",
    ),
    "ollama": ProviderInfo(
        "ollama",
        "Ollama (on your computer)",
        "Install from https://ollama.com, then run: ollama pull <model>",
        "Runs entirely on your computer. Nothing leaves your machine.",
    ),
}


def default_model(settings: Settings, provider: str) -> str:
    return {
        "gemini": settings.gemini_model,
        "groq": settings.groq_model,
        "ollama": settings.ollama_model,
    }[provider]


def is_configured(settings: Settings, provider: str) -> bool:
    if provider == "gemini":
        return bool(settings.gemini_api_key)
    if provider == "groq":
        return bool(settings.groq_api_key)
    return bool(settings.ollama_base_url)  # reachable or not is checked by "Test connection"


def build_ai_provider(settings: Settings, provider: str, model: str) -> AIProvider | None:
    """The provider ready to call, or None when it isn't set up."""
    if not is_configured(settings, provider):
        return None
    timeout = settings.ai_timeout_seconds
    if provider == "gemini":
        return GeminiProvider(settings.gemini_api_key, model, timeout)
    if provider == "groq":
        return GroqProvider(settings.groq_api_key, model, timeout)
    return OllamaProvider(settings.ollama_base_url, model, max(timeout, 180))
