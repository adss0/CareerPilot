from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import ApplicationServiceDep
from app.models import ApplicationStatus
from app.schemas.application import (
    ApplicationCreate,
    ApplicationPage,
    ApplicationRead,
    ApplicationUpdate,
    StatusHistoryRead,
)

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("", response_model=ApplicationPage)
def list_applications(
    service: ApplicationServiceDep,
    status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ApplicationPage:
    items, total = service.search(status=status_filter, search=search, limit=limit, offset=offset)
    return ApplicationPage(
        items=[ApplicationRead.model_validate(a) for a in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationCreate, service: ApplicationServiceDep):
    return service.create(data)


@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(application_id: int, service: ApplicationServiceDep):
    return service.get(application_id)


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int, data: ApplicationUpdate, service: ApplicationServiceDep
):
    return service.update(application_id, data)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: int, service: ApplicationServiceDep) -> None:
    service.delete(application_id)


@router.get("/{application_id}/history", response_model=list[StatusHistoryRead])
def get_application_history(application_id: int, service: ApplicationServiceDep):
    return service.history(application_id)
