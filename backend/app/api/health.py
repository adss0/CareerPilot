from fastapi import APIRouter

from app.api.deps import AIProviderDep
from app.core.config import get_settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(ai: AIProviderDep) -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=settings.version,
        ai_provider=settings.ai_provider,
        ai_configured=ai is not None,
    )
