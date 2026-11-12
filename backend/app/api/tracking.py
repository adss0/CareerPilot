from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AIProviderDep, SessionDep
from app.core.config import get_settings
from app.core.errors import BadRequestError
from app.schemas.email import EmailLogRead
from app.schemas.tracking import (
    CalendarEvent,
    FollowUpDraft,
    FollowUpSend,
    NotificationSummary,
    ReplyCheckResult,
    ReplyRead,
)
from app.services.tracking_service import TrackingService

router = APIRouter(tags=["tracking"])


def get_tracking_service(session: SessionDep, ai: AIProviderDep) -> TrackingService:
    return TrackingService(session, get_settings(), ai)


TrackingDep = Annotated[TrackingService, Depends(get_tracking_service)]


@router.post("/applications/{application_id}/follow-up/draft", response_model=FollowUpDraft)
def draft_follow_up(application_id: int, service: TrackingDep) -> FollowUpDraft:
    """A polite follow-up, written by AI if it's set up, otherwise from a template."""
    return service.draft_follow_up(application_id)


@router.post(
    "/applications/{application_id}/follow-up/send",
    response_model=EmailLogRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def send_follow_up(application_id: int, data: FollowUpSend, service: TrackingDep) -> EmailLogRead:
    return service.send_follow_up(application_id, data.subject, data.body)


@router.get("/replies", response_model=list[ReplyRead])
def list_replies(
    service: TrackingDep,
    application_id: Annotated[int | None, Query()] = None,
    unseen: Annotated[bool, Query()] = False,
) -> list[ReplyRead]:
    return service.replies(application_id, unseen_only=unseen)


@router.post("/replies/check", response_model=ReplyCheckResult)
def check_replies(service: TrackingDep) -> ReplyCheckResult:
    return service.check_replies()


@router.post("/replies/{reply_id}/seen", status_code=204)
def mark_reply_seen(reply_id: int, service: TrackingDep) -> None:
    service.mark_seen(reply_id)


@router.get("/notifications", response_model=NotificationSummary)
def notifications(service: TrackingDep) -> NotificationSummary:
    return service.notifications()


@router.get("/calendar", response_model=list[CalendarEvent])
def calendar(
    service: TrackingDep, start: Annotated[datetime, Query()], end: Annotated[datetime, Query()]
) -> list[CalendarEvent]:
    if end <= start or (end - start).days > 100:
        raise BadRequestError("Choose a date range of up to 100 days.")
    return service.calendar(start, end)
