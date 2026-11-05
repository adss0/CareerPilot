from fastapi import APIRouter

from app.api.deps import ProfileServiceDep
from app.schemas.profile import ProfileRead, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileRead)
def get_profile(service: ProfileServiceDep) -> ProfileRead:
    return service.get()


@router.put("", response_model=ProfileRead)
def update_profile(data: ProfileUpdate, service: ProfileServiceDep) -> ProfileRead:
    return service.update(data)
