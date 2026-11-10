from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.config import get_settings
from app.core.db import get_engine, get_session
from app.integrations.ai import AIProvider
from app.services.ai_settings_service import AiSettingsService
from app.services.application_service import ApplicationService
from app.services.cv_service import CvService
from app.services.import_service import ImportService
from app.services.letter_queue import LetterQueue
from app.services.letter_service import LetterService
from app.services.profile_service import ProfileService

SessionDep = Annotated[Session, Depends(get_session)]


def get_ai_settings_service(session: SessionDep) -> AiSettingsService:
    return AiSettingsService(session, get_settings())


AiSettingsServiceDep = Annotated[AiSettingsService, Depends(get_ai_settings_service)]


def get_ai_provider(settings: AiSettingsServiceDep) -> AIProvider | None:
    return settings.build_provider()


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


def get_letter_service(session: SessionDep, ai: AIProviderDep) -> LetterService:
    return LetterService(session, ai)


@lru_cache
def get_letter_queue() -> LetterQueue:
    """One queue for the whole app, so bulk jobs never run at the same time."""
    return LetterQueue(
        session_factory=lambda: Session(get_engine()),
        ai_factory=lambda session: AiSettingsService(session, get_settings()).build_provider(),
        gap_factory=lambda session: AiSettingsService(session, get_settings()).request_gap_seconds,
    )


ApplicationServiceDep = Annotated[ApplicationService, Depends(get_application_service)]
ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
ImportServiceDep = Annotated[ImportService, Depends(get_import_service)]
CvServiceDep = Annotated[CvService, Depends(get_cv_service)]
LetterServiceDep = Annotated[LetterService, Depends(get_letter_service)]
LetterQueueDep = Annotated[LetterQueue, Depends(get_letter_queue)]
