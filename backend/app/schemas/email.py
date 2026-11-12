from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.enums import EmailStatus

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _blank_to_none(value):
    return None if value == "" else value


class EmailSettings(BaseModel):
    """How CareerPilot sends email. The password is never here: it lives in backend/.env."""

    from_name: str = Field(default="", max_length=100)
    from_address: EmailStr | None = None
    smtp_host: str = Field(default="smtp.gmail.com", max_length=200)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    username: str = Field(default="", max_length=320)  # usually the same as from_address
    imap_host: str = Field(default="imap.gmail.com", max_length=200)
    imap_port: int = Field(default=993, ge=1, le=65535)
    daily_limit: int = Field(default=20, ge=1, le=100)
    min_gap_seconds: int = Field(default=60, ge=0, le=3600)
    max_gap_seconds: int = Field(default=180, ge=0, le=7200)
    signature: str = Field(default="", max_length=1000)
    # Safety first: until switched off, every email goes to test_address (or from_address).
    test_mode: bool = True
    test_address: EmailStr | None = None
    follow_up_days: int = Field(default=7, ge=1, le=60)

    _clean = field_validator("from_address", "test_address", mode="before")(_blank_to_none)

    @model_validator(mode="after")
    def _check(self):
        if self.max_gap_seconds < self.min_gap_seconds:
            raise ValueError("The longest pause can't be shorter than the shortest pause.")
        if self.smtp_security == "none" and self.smtp_host.strip().lower() not in LOCAL_HOSTS:
            raise ValueError("Unencrypted email is only allowed to this computer (localhost).")
        return self


class EmailSettingsRead(EmailSettings):
    password_set: bool
    ready: bool
    problems: list[str]


class EmailSettingsUpdate(BaseModel):
    """Any subset of the settings; the merged result is validated as a whole."""

    model_config = ConfigDict(extra="forbid")

    from_name: str | None = None
    from_address: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_security: Literal["starttls", "ssl", "none"] | None = None
    username: str | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    daily_limit: int | None = None
    min_gap_seconds: int | None = None
    max_gap_seconds: int | None = None
    signature: str | None = None
    test_mode: bool | None = None
    test_address: str | None = None
    follow_up_days: int | None = None


class ConnectionTestResult(BaseModel):
    ok: bool
    message: str


class Attachment(BaseModel):
    name: str
    size_bytes: int | None = None


class EmailPreview(BaseModel):
    to: str  # the employer's address
    deliver_to: str  # where it will really go (your own address in test mode)
    test_mode: bool
    subject: str
    body: str
    attachments: list[Attachment]
    can_send: bool
    problems: list[str]  # anything that blocks sending
    warnings: list[str]  # worth knowing, but doesn't block


class SendRequest(BaseModel):
    # Sending needs an explicit "yes": nothing is queued without it.
    confirm: Literal[True]


class BulkSendRequest(BaseModel):
    application_ids: list[int] = Field(min_length=1, max_length=200)
    confirm: Literal[True]


class BulkSendSkip(BaseModel):
    application_id: int
    reason: str


class BulkSendResult(BaseModel):
    queued: int
    skipped: list[BulkSendSkip]


class EmailLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    kind: str
    to_address: str
    subject: str
    body: str
    attachments: list[str]
    status: EmailStatus
    is_test: bool
    error: str
    sent_at: datetime | None
    created_at: datetime


class QueueStatus(BaseModel):
    ready: bool
    problems: list[str]
    queued: int
    sent_today: int
    daily_limit: int
    test_mode: bool
    next_send_at: datetime | None
