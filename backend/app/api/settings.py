from fastapi import APIRouter

from app.api.deps import AIProviderDep, AiSettingsServiceDep
from app.schemas.settings import AiSettingsRead, AiSettingsUpdate, AiTestResult

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
