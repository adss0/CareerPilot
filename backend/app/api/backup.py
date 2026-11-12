from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.core.config import HOME_DIR, get_settings
from app.services.backup_service import MAX_BACKUP_BYTES, BackupService

router = APIRouter(tags=["backup"])


def get_backup_service() -> BackupService:
    settings = get_settings()
    return BackupService(settings.db_file, settings.cv_dir, HOME_DIR, settings.version)


BackupDep = Annotated[BackupService, Depends(get_backup_service)]


@router.get("/backup", response_class=Response)
def download_backup(service: BackupDep) -> Response:
    """Everything (database + CVs) as one .zip. API keys are never included."""
    filename = f"careerpilot-backup-{date.today().isoformat()}.zip"
    return Response(
        content=service.create(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore", status_code=status.HTTP_202_ACCEPTED)
async def restore_backup(service: BackupDep, file: Annotated[UploadFile, File()]) -> dict:
    content = await file.read(MAX_BACKUP_BYTES + 1)
    staged = service.stage(content)
    return {
        **staged,
        "message": "Backup checked and ready. Restart CareerPilot to finish restoring. "
        "Your current data will be kept in the backups folder.",
    }


@router.get("/restore")
def restore_status(service: BackupDep) -> dict:
    return {"pending": service.pending()}


@router.delete("/restore", status_code=204)
def cancel_restore(service: BackupDep) -> None:
    service.cancel()
