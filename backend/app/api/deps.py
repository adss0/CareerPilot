from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.db import get_session
from app.services.application_service import ApplicationService
from app.services.import_service import ImportService
from app.services.profile_service import ProfileService

SessionDep = Annotated[Session, Depends(get_session)]


def get_application_service(session: SessionDep) -> ApplicationService:
    return ApplicationService(session)


def get_profile_service(session: SessionDep) -> ProfileService:
    return ProfileService(session)


def get_import_service(session: SessionDep) -> ImportService:
    return ImportService(session)


ApplicationServiceDep = Annotated[ApplicationService, Depends(get_application_service)]
ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
ImportServiceDep = Annotated[ImportService, Depends(get_import_service)]
