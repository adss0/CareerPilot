from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.stats import StatsRead
from app.services.stats_service import StatsService

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsRead)
def get_stats(session: SessionDep) -> StatsRead:
    return StatsService(session).get()
