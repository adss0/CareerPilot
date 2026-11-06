from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.config import get_settings
from app.core.db import get_session
from app.integrations.ai import AIProvider, build_ai_provider
from app.services.application_service import ApplicationService
from app.services.cv_service import CvService
from app.services.import_service import ImportService
from app.services.profile_service import ProfileService

SessionDep = Annotated[Session, Depends(get_session)]


@lru_cache
def get_ai_provider() -> AIProvider | None:
    return build_ai_provider(get_settings())


def get_cv_storage_dir() -> Path:
    return get_settings().cv_dir


AIProviderDep = Annotated[AIProvider | None, Depends(get_ai_provider)]


def get_application_service(session: SessionDep) -> ApplicationService:
    return ApplicationService(session)


def get_profile_service(session: SessionDep) -> ProfileService:
    return ProfileService(session)


def get_import_service(session: SessionDep) -> ImportService:
    return ImportService(session)


def get_cv_service(
    session: SessionDep,
    ai: AIProviderDep,
    storage_dir: Annotated[Path, Depends(get_cv_storage_dir)],
) -> CvService:
    return CvService(session, storage_dir, ai)


ApplicationServiceDep = Annotated[ApplicationService, Depends(get_application_service)]
ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
ImportServiceDep = Annotated[ImportService, Depends(get_import_service)]
CvServiceDep = Annotated[CvService, Depends(get_cv_service)]
