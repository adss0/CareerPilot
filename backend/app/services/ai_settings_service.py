import re

from sqlmodel import Session

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.integrations.ai import (
    PROVIDERS,
    AIError,
    AIProvider,
    build_ai_provider,
    default_model,
    is_configured,
)
from app.models import AppSetting
from app.schemas.settings import (
    AiSettingsRead,
    AiSettingsUpdate,
    AiTestResult,
    ProviderName,
    ProviderStatus,
)

SETTINGS_KEY = "ai"
MODEL_NAME_RE = re.compile(r"^[\w.:/-]+$")


class AiSettingsService:
    """Which AI provider/model to use. Chosen in the UI; keys always come from .env."""

    def __init__(self, session: Session, env: Settings):
        self.session = session
        self.env = env

    def _stored(self) -> dict:
        row = self.session.get(AppSetting, SETTINGS_KEY)
        return dict(row.value) if row else {}

    @property
    def provider_name(self) -> ProviderName:
        stored = self._stored().get("provider")
        return stored if stored in PROVIDERS else self.env.ai_provider

    def model_for(self, provider: str) -> str:
        return self._stored().get("models", {}).get(provider) or default_model(self.env, provider)

    @property
    def request_gap_seconds(self) -> float:
        value = self._stored().get("request_gap_seconds")
        return float(value) if value is not None else self.env.ai_request_gap_seconds

    def get(self) -> AiSettingsRead:
        provider = self.provider_name
        return AiSettingsRead(
            provider=provider,
            model=self.model_for(provider),
            request_gap_seconds=self.request_gap_seconds,
            providers=[
                ProviderStatus(
                    name=name,
                    label=info.label,
                    configured=is_configured(self.env, name),
                    model=self.model_for(name),
                    default_model=default_model(self.env, name),
                    setup=info.setup,
                    privacy=info.privacy,
                )
                for name, info in PROVIDERS.items()
            ],
        )

    def update(self, data: AiSettingsUpdate) -> AiSettingsRead:
        stored = self._stored()
        provider = data.provider or self.provider_name
        if data.provider:
            stored["provider"] = data.provider
        if data.model is not None:
            model = data.model.strip()
            if model and not MODEL_NAME_RE.fullmatch(model):
                raise BadRequestError("Model names can only contain letters, numbers and . : / - _")
            models = dict(stored.get("models", {}))
            if model:
                models[provider] = model
            else:
                models.pop(provider, None)  # back to the default
            stored["models"] = models
        if data.request_gap_seconds is not None:
            stored["request_gap_seconds"] = data.request_gap_seconds

        row = self.session.get(AppSetting, SETTINGS_KEY) or AppSetting(key=SETTINGS_KEY)
        row.value = stored
        self.session.add(row)
        self.session.commit()
        return self.get()

    def build_provider(self) -> AIProvider | None:
        provider = self.provider_name
        return build_ai_provider(self.env, provider, self.model_for(provider))

    def test(self, provider: AIProvider | None) -> AiTestResult:
        name = self.provider_name
        model = self.model_for(name)
        if provider is None:
            return AiTestResult(
                ok=False,
                message=f"{PROVIDERS[name].label} isn't set up yet. {PROVIDERS[name].setup}",
                provider=name,
                model=model,
            )
        try:
            reply = provider.generate_json(
                'Reply with exactly this JSON: {"ok": true}', "Connection test."
            )
        except AIError as exc:
            return AiTestResult(ok=False, message=str(exc), provider=name, model=model)
        ok = reply.get("ok") is True
        message = (
            "Connected. The AI is ready." if ok else "Connected, but the reply was unexpected."
        )
        return AiTestResult(ok=ok, message=message, provider=name, model=model)
