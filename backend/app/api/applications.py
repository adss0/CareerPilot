from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status

from app.api.backup import BackupDep
from app.api.deps import ApplicationServiceDep
from app.models import ApplicationStatus
from app.schemas.application import (
    ApplicationCreate,
    ApplicationPage,
    ApplicationRead,
    ApplicationUpdate,
    BulkApplicationAction,
    BulkApplicationResult,
    DeleteAll,
    DeleteAllResult,
    DueItem,
    StatusHistoryRead,
    TrackerSummary,
)
from app.services.excel_export import XLSX_MEDIA_TYPE
from app.services.tracker import due_items

router = APIRouter(prefix="/applications", tags=["applications"])

SortKey = Literal[
    "created_at", "-created_at", "updated_at", "-updated_at", "company", "-company",
    "role", "-role", "status", "-status", "priority", "-priority",
]  # fmt: skip


@router.get("", response_model=ApplicationPage)
def list_applications(
    service: ApplicationServiceDep,
    status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    sort: Annotated[SortKey, Query()] = "-created_at",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    hide_closed: bool = False,
) -> ApplicationPage:
    items, total = service.search(
        status=status_filter,
        search=search,
        sort=sort,
        limit=limit,
        offset=offset,
        hide_closed=hide_closed,
    )
    return ApplicationPage(
        items=service.to_read(items),
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationCreate, service: ApplicationServiceDep):
    return service.to_read([service.create(data)])[0]


@router.post("/bulk", response_model=BulkApplicationResult)
def bulk_update_applications(
    data: BulkApplicationAction, service: ApplicationServiceDep
) -> BulkApplicationResult:
    return service.bulk(data)


# Declared before "/{application_id}" so "export" isn't read as an id.
@router.get("/summary", response_model=TrackerSummary)
def get_tracker_summary(service: ApplicationServiceDep) -> TrackerSummary:
    return service.tracker_summary()


@router.get("/due", response_model=list[DueItem])
def get_due(
    service: ApplicationServiceDep, days: Annotated[int, Query(ge=1, le=60)] = 7
) -> list[DueItem]:
    """Applications closing and assessments due in the next few days (and overdue ones)."""
    return due_items(service.repo.all(), days=days)


@router.post("/delete-all", response_model=DeleteAllResult)
def delete_all_applications(
    data: DeleteAll, service: ApplicationServiceDep, backups: BackupDep
) -> DeleteAllResult:
    """Moves every job to the recycle bin, after saving a full backup."""
    path = backups.save_backup("before-delete-all")
    return DeleteAllResult(deleted=service.delete_all(), backup=str(path))


@router.get("/export", response_class=Response)
def export_applications(
    service: ApplicationServiceDep,
    status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
) -> Response:
    filename = f"careerpilot-applications-{date.today().isoformat()}.xlsx"
    return Response(
        content=service.export_workbook(status=status_filter),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(application_id: int, service: ApplicationServiceDep):
    return service.to_read([service.get(application_id)])[0]


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int, data: ApplicationUpdate, service: ApplicationServiceDep
):
    return service.to_read([service.update(application_id, data)])[0]


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: int, service: ApplicationServiceDep) -> None:
    service.delete(application_id)


@router.get("/{application_id}/history", response_model=list[StatusHistoryRead])
def get_application_history(application_id: int, service: ApplicationServiceDep):
    return service.history(application_id)
