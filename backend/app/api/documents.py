"""Tailored CVs, and the folder where CVs and cover letters are saved as Word + PDF."""

from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status

from app.api.deps import (
    CvServiceDep,
    DocumentsServiceDep,
    LetterServiceDep,
    TailoredCvServiceDep,
)
from app.schemas.cv import CvRead
from app.schemas.documents import (
    DocumentSettingsRead,
    DocumentSettingsUpdate,
    OpenFolderResult,
    SavedDocuments,
)
from app.schemas.tailored_cv import TailoredCvRead, TailoredCvUpdate

router = APIRouter(tags=["documents"])


@router.get("/applications/{application_id}/tailored-cv", response_model=TailoredCvRead)
def get_tailored_cv(application_id: int, service: TailoredCvServiceDep) -> TailoredCvRead:
    return service.get(application_id)


@router.post(
    "/applications/{application_id}/tailored-cv",
    response_model=TailoredCvRead,
    status_code=status.HTTP_201_CREATED,
)
def tailor_cv(application_id: int, service: TailoredCvServiceDep) -> TailoredCvRead:
    return service.generate(application_id)


@router.put("/applications/{application_id}/tailored-cv", response_model=TailoredCvRead)
def update_tailored_cv(
    application_id: int, data: TailoredCvUpdate, service: TailoredCvServiceDep
) -> TailoredCvRead:
    return service.update(application_id, data.content)


@router.delete("/applications/{application_id}/tailored-cv", status_code=status.HTTP_204_NO_CONTENT)
def delete_tailored_cv(application_id: int, service: TailoredCvServiceDep) -> None:
    service.delete(application_id)


@router.get("/applications/{application_id}/tailored-cv/export", response_class=Response)
def export_tailored_cv(
    application_id: int,
    service: TailoredCvServiceDep,
    file_format: Annotated[Literal["pdf", "docx"], Query(alias="format")] = "pdf",
) -> Response:
    content, filename, media_type = service.export(application_id, file_format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/applications/{application_id}/tailored-cv/use-as-main", response_model=CvRead)
def use_tailored_cv_as_main(
    application_id: int, service: TailoredCvServiceDep, cvs: CvServiceDep
) -> CvRead:
    """Saves the tailored CV as a PDF in Profile → Your CVs and makes it the main CV."""
    return service.use_as_main(application_id, cvs)


@router.post("/applications/{application_id}/documents/save", response_model=SavedDocuments)
def save_documents(
    application_id: int,
    cvs: TailoredCvServiceDep,
    letters: LetterServiceDep,
    documents: DocumentsServiceDep,
) -> SavedDocuments:
    """Saves this job's tailored CV and starred cover letter to the folder right now."""
    return SavedDocuments(folders=letters.save_documents(application_id, cvs, documents))


@router.get("/settings/documents", response_model=DocumentSettingsRead)
def get_document_settings(documents: DocumentsServiceDep) -> DocumentSettingsRead:
    return documents.settings()


@router.put("/settings/documents", response_model=DocumentSettingsRead)
def update_document_settings(
    data: DocumentSettingsUpdate, documents: DocumentsServiceDep
) -> DocumentSettingsRead:
    return documents.update(data)


@router.post("/documents/open", response_model=OpenFolderResult)
def open_documents_folder(
    documents: DocumentsServiceDep,
    cvs: TailoredCvServiceDep,
    application_id: int | None = None,
) -> OpenFolderResult:
    """Opens the folder in File Explorer (this computer only: the server is local)."""
    folder = None
    if application_id is not None:
        application = cvs.applications.get(application_id)
        has_cv = cvs.find(application_id) is not None
        folder = documents.cv_dir(application) if has_cv else documents.letter_dir(application)
        if not folder.exists():
            folder = None
    return OpenFolderResult(folder=documents.open_folder(folder))
