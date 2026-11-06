from app.core.config import Settings
from app.integrations.ai.base import AIError, AIProvider
from app.integrations.ai.gemini import GeminiProvider

__all__ = ["AIError", "AIProvider", "build_ai_provider"]


def build_ai_provider(settings: Settings) -> AIProvider | None:
    """The configured provider, or None when no AI is set up. Groq and Ollama come in Phase 4."""
    if settings.ai_provider == "gemini" and settings.gemini_api_key:
        return GeminiProvider(
            settings.gemini_api_key, settings.gemini_model, settings.ai_timeout_seconds
        )
    return None
