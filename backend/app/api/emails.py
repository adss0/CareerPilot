from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import EmailQueueDep, EmailServiceDep, EmailSettingsServiceDep, SessionDep
from app.integrations.email.smtp import check_login
from app.schemas.email import (
    BulkSendRequest,
    BulkSendResult,
    ConnectionTestResult,
    EmailLogRead,
    EmailPreview,
    EmailSettingsRead,
    EmailSettingsUpdate,
    QueueStatus,
    SendRequest,
)

router = APIRouter(tags=["email"])


@router.get("/settings/email", response_model=EmailSettingsRead)
def get_email_settings(service: EmailSettingsServiceDep) -> EmailSettingsRead:
    return service.get()


@router.put("/settings/email", response_model=EmailSettingsRead)
def update_email_settings(
    data: EmailSettingsUpdate, service: EmailSettingsServiceDep
) -> EmailSettingsRead:
    return service.update(data)


@router.post("/settings/email/test", response_model=ConnectionTestResult)
def test_email_connection(service: EmailSettingsServiceDep) -> ConnectionTestResult:
    return service.test_connection(check_login)


@router.get("/applications/{application_id}/email/preview", response_model=EmailPreview)
def preview_email(application_id: int, service: EmailServiceDep) -> EmailPreview:
    return service.preview(application_id)


@router.post(
    "/applications/{application_id}/email/send",
    response_model=EmailLogRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def send_email(application_id: int, _: SendRequest, service: EmailServiceDep) -> EmailLogRead:
    """Approves the email: it joins the send queue (nothing is sent without confirm=true)."""
    return service.queue(application_id)


@router.post("/applications/{application_id}/mark-applied", status_code=204)
def mark_applied(application_id: int, service: EmailServiceDep) -> None:
    """Assisted apply: you submitted the application on the job's website yourself."""
    service.mark_applied(application_id)


@router.post("/emails/bulk", response_model=BulkSendResult, status_code=status.HTTP_202_ACCEPTED)
def send_many(data: BulkSendRequest, service: EmailServiceDep) -> BulkSendResult:
    return service.queue_many(data.application_ids)


@router.get("/emails", response_model=list[EmailLogRead])
def list_emails(
    service: EmailServiceDep, application_id: Annotated[int | None, Query()] = None
) -> list[EmailLogRead]:
    return service.logs(application_id)


@router.get("/emails/queue", response_model=QueueStatus)
def queue_status(session: SessionDep, email_queue: EmailQueueDep) -> QueueStatus:
    return email_queue.status(session)


@router.post("/emails/{log_id}/cancel", response_model=EmailLogRead)
def cancel_email(log_id: int, service: EmailServiceDep) -> EmailLogRead:
    return service.cancel(log_id)


@router.post("/emails/{log_id}/retry", response_model=EmailLogRead)
def retry_email(log_id: int, service: EmailServiceDep) -> EmailLogRead:
    return service.retry(log_id)
