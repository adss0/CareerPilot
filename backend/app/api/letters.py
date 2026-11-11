from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status

from app.api.deps import LetterQueueDep, LetterServiceDep
from app.schemas.letters import (
    BulkLetterRequest,
    LetterGenerate,
    LetterJobRead,
    LetterRead,
    LetterUpdate,
)

router = APIRouter(tags=["letters"])


@router.get("/applications/{application_id}/letters", response_model=list[LetterRead])
def list_letters(application_id: int, service: LetterServiceDep) -> list[LetterRead]:
    return service.for_application(application_id)


@router.post(
    "/applications/{application_id}/letters",
    response_model=LetterRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_letter(
    application_id: int, data: LetterGenerate, service: LetterServiceDep
) -> LetterRead:
    return service.generate(application_id, data.tone, data.instructions)


@router.patch("/letters/{letter_id}", response_model=LetterRead)
def update_letter(letter_id: int, data: LetterUpdate, service: LetterServiceDep) -> LetterRead:
    return service.update(letter_id, data)


@router.delete("/letters/{letter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_letter(letter_id: int, service: LetterServiceDep) -> None:
    service.delete(letter_id)


@router.get("/letters/{letter_id}/export", response_class=Response)
def export_letter(
    letter_id: int,
    service: LetterServiceDep,
    file_format: Annotated[Literal["pdf", "docx"], Query(alias="format")] = "pdf",
) -> Response:
    content, filename, media_type = service.export(letter_id, file_format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/letters/bulk", response_model=LetterJobRead, status_code=status.HTTP_202_ACCEPTED)
def start_bulk_letters(request: BulkLetterRequest, letter_queue: LetterQueueDep) -> LetterJobRead:
    return letter_queue.submit(request)


@router.get("/letters/jobs/{job_id}", response_model=LetterJobRead)
def get_bulk_job(job_id: str, letter_queue: LetterQueueDep) -> LetterJobRead:
    return letter_queue.get(job_id)


@router.post("/letters/jobs/{job_id}/cancel", response_model=LetterJobRead)
def cancel_bulk_job(job_id: str, letter_queue: LetterQueueDep) -> LetterJobRead:
    return letter_queue.cancel(job_id)
