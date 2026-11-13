from fastapi import APIRouter

from app.api.deps import AIProviderDep, AiSettingsServiceDep, SecretsServiceDep
from app.schemas.settings import (
    AiSettingsRead,
    AiSettingsUpdate,
    AiTestResult,
    SecretName,
    SecretsStatus,
    SecretUpdate,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/ai", response_model=AiSettingsRead)
def get_ai_settings(service: AiSettingsServiceDep) -> AiSettingsRead:
    return service.get()


@router.put("/ai", response_model=AiSettingsRead)
def update_ai_settings(data: AiSettingsUpdate, service: AiSettingsServiceDep) -> AiSettingsRead:
    return service.update(data)


@router.post("/ai/test", response_model=AiTestResult)
def test_ai_connection(service: AiSettingsServiceDep, ai: AIProviderDep) -> AiTestResult:
    return service.test(ai)


@router.get("/secrets", response_model=SecretsStatus)
def get_secrets(service: SecretsServiceDep) -> SecretsStatus:
    return service.status()


@router.put("/secrets/{name}", response_model=SecretsStatus)
def set_secret(name: SecretName, data: SecretUpdate, service: SecretsServiceDep) -> SecretsStatus:
    return service.set(name, data.value)
