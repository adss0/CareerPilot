import json
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status

from app.api.deps import ImportServiceDep
from app.schemas.imports import ImportPreview, ImportResult
from app.services.excel_export import XLSX_MEDIA_TYPE, build_template_workbook
from app.services.spreadsheet_reader import MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS

router = APIRouter(prefix="/imports", tags=["imports"])

UploadDep = Annotated[UploadFile, File(description="A .xlsx, .xls or .csv file (max 5 MB)")]
SheetDep = Annotated[str | None, Form(max_length=200)]


async def _read_upload(file: UploadFile) -> tuple[str, bytes]:
    filename = file.filename or ""
    if not filename.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Unsupported file type. Upload a .xlsx, .xls or .csv file.",
        )
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file is over 5 MB.")
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")
    return filename, content


@router.post("/preview", response_model=ImportPreview)
async def preview_import(
    service: ImportServiceDep, file: UploadDep, sheet: SheetDep = None
) -> ImportPreview:
    filename, content = await _read_upload(file)
    return service.preview(filename, content, sheet or None)


@router.post("/commit", response_model=ImportResult)
async def commit_import(
    service: ImportServiceDep,
    file: UploadDep,
    mapping: Annotated[str, Form(description='JSON, e.g. {"company": "Employer"}')],
    sheet: SheetDep = None,
) -> ImportResult:
    filename, content = await _read_upload(file)
    try:
        parsed = json.loads(mapping)
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mapping must be valid JSON.") from exc
    if not isinstance(parsed, dict) or not all(isinstance(v, str | None) for v in parsed.values()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Mapping must be an object of field → column name."
        )
    return service.commit(filename, content, sheet or None, parsed)


@router.get("/template", response_class=Response)
def download_template() -> Response:
    return Response(
        content=build_template_workbook(),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="careerpilot-jobs-template.xlsx"'},
    )
