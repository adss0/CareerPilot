from typing import Literal

from pydantic import BaseModel, Field

ProviderName = Literal["gemini", "groq", "ollama"]


class ProviderStatus(BaseModel):
    name: ProviderName
    label: str
    configured: bool
    model: str
    default_model: str
    setup: str
    privacy: str


class AiSettingsRead(BaseModel):
    provider: ProviderName
    model: str
    request_gap_seconds: float
    providers: list[ProviderStatus]


class AiSettingsUpdate(BaseModel):
    provider: ProviderName | None = None
    model: str | None = Field(default=None, max_length=100)  # for the chosen provider; "" = default
    request_gap_seconds: float | None = Field(default=None, ge=0, le=120)


class AiTestResult(BaseModel):
    ok: bool
    message: str
    provider: ProviderName
    model: str
