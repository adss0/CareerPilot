from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.config import HOME_DIR, get_settings
from app.core.db import get_engine, get_session
from app.integrations.ai import AIProvider
from app.services.ai_settings_service import AiSettingsService
from app.services.application_service import ApplicationService
from app.services.cv_service import CvService
from app.services.documents_service import DocumentsService
from app.services.email_queue import EmailQueue
from app.services.email_service import EmailService
from app.services.email_settings_service import EmailSettingsService
from app.services.import_service import ImportService
from app.services.letter_queue import LetterQueue
from app.services.letter_service import LetterService
from app.services.profile_service import ProfileService
from app.services.secrets_service import SecretsService
from app.services.tailored_cv_service import TailoredCvService
from app.services.tracking_service import ReplyChecker

SessionDep = Annotated[Session, Depends(get_session)]


def get_ai_settings_service(session: SessionDep) -> AiSettingsService:
    return AiSettingsService(session, get_settings())


AiSettingsServiceDep = Annotated[AiSettingsService, Depends(get_ai_settings_service)]


def get_ai_provider(settings: AiSettingsServiceDep) -> AIProvider | None:
    return settings.build_provider()


def get_cv_storage_dir() -> Path:
    return get_settings().cv_dir


AIProviderDep = Annotated[AIProvider | None, Depends(get_ai_provider)]


def get_secrets_service() -> SecretsService:
    return SecretsService(get_settings(), HOME_DIR / ".env")


SecretsServiceDep = Annotated[SecretsService, Depends(get_secrets_service)]


def get_documents_service(session: SessionDep) -> DocumentsService:
    return DocumentsService(session)


DocumentsServiceDep = Annotated[DocumentsService, Depends(get_documents_service)]


def get_tailored_cv_service(session: SessionDep, ai: AIProviderDep) -> TailoredCvService:
    return TailoredCvService(session, ai)


TailoredCvServiceDep = Annotated[TailoredCvService, Depends(get_tailored_cv_service)]


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


def get_email_settings_service(session: SessionDep) -> EmailSettingsService:
    return EmailSettingsService(session, get_settings())


def get_email_service(
    session: SessionDep, storage_dir: Annotated[Path, Depends(get_cv_storage_dir)]
) -> EmailService:
    return EmailService(session, get_settings(), storage_dir)


@lru_cache
def get_email_queue() -> EmailQueue:
    """One send queue for the whole app (started when the server starts)."""
    return EmailQueue(lambda: Session(get_engine()), get_settings(), get_settings().cv_dir)


@lru_cache
def get_reply_checker() -> ReplyChecker:
    return ReplyChecker(lambda: Session(get_engine()), get_settings(), get_settings().cv_dir)


ApplicationServiceDep = Annotated[ApplicationService, Depends(get_application_service)]
ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
ImportServiceDep = Annotated[ImportService, Depends(get_import_service)]
CvServiceDep = Annotated[CvService, Depends(get_cv_service)]
LetterServiceDep = Annotated[LetterService, Depends(get_letter_service)]
LetterQueueDep = Annotated[LetterQueue, Depends(get_letter_queue)]
EmailSettingsServiceDep = Annotated[EmailSettingsService, Depends(get_email_settings_service)]
EmailServiceDep = Annotated[EmailService, Depends(get_email_service)]
EmailQueueDep = Annotated[EmailQueue, Depends(get_email_queue)]
