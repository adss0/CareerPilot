from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CvServiceDep
from app.schemas.cv import CvParseResult, CvRead, CvUpdate
from app.services.cv_text import MAX_CV_BYTES, cv_extension

router = APIRouter(prefix="/cvs", tags=["cvs"])


@router.get("", response_model=list[CvRead])
def list_cvs(service: CvServiceDep) -> list[CvRead]:
    return service.list()


@router.post("", response_model=CvParseResult, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    service: CvServiceDep,
    file: Annotated[UploadFile, File(description="A .pdf, .docx or .txt CV (max 5 MB)")],
    label: Annotated[str | None, Form(max_length=100)] = None,
    use_ai: Annotated[
        bool, Form(description="Read the CV with AI (sends its text to the AI provider)")
    ] = False,
) -> CvParseResult:
    filename = file.filename or ""
    if cv_extension(filename) is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Unsupported file type. Upload a .pdf, .docx or .txt file.",
        )
    content = await file.read(MAX_CV_BYTES + 1)
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file is over 5 MB.")
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")
    return service.upload(filename, content, label, use_ai)


@router.patch("/{cv_id}", response_model=CvRead)
def update_cv(cv_id: int, data: CvUpdate, service: CvServiceDep) -> CvRead:
    return service.update(cv_id, data)


@router.delete("/{cv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cv(cv_id: int, service: CvServiceDep) -> None:
    service.delete(cv_id)


@router.post("/{cv_id}/parse", response_model=CvParseResult)
def parse_cv(
    cv_id: int, service: CvServiceDep, use_ai: Annotated[bool, Form()] = False
) -> CvParseResult:
    return service.parse(cv_id, use_ai)


@router.get("/{cv_id}/file", response_class=FileResponse)
def download_cv(cv_id: int, service: CvServiceDep) -> FileResponse:
    cv = service.get(cv_id)
    path = service.file_path(cv)
    if not path.is_file():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "The CV file is missing from the data folder."
        )
    return FileResponse(path, media_type=cv.content_type, filename=cv.original_filename)
