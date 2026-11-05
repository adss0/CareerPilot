"""Database tables. Only repositories should query these directly."""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from app.models.enums import ApplicationStatus, EmailStatus


def utcnow() -> datetime:
    return datetime.now(UTC)


def _application_fk() -> Column:
    # Deleting an application also deletes its letters, emails and history.
    return Column(
        Integer, ForeignKey("application.id", ondelete="CASCADE"), nullable=False, index=True
    )


class Profile(SQLModel, table=True):
    """The user's own details. The app keeps a single profile row (id=1)."""

    id: int | None = Field(default=None, primary_key=True)
    full_name: str = Field(default="", max_length=200)
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=50)
    location: str = Field(default="", max_length=200)
    linkedin_url: str = Field(default="", max_length=500)
    github_url: str = Field(default="", max_length=500)
    portfolio_url: str = Field(default="", max_length=500)
    summary: str = ""
    skills: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    cv_text: str = ""
    cv_file_path: str = Field(default="", max_length=1000)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ImportBatch(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    filename: str = Field(max_length=500)
    rows_total: int = 0
    rows_imported: int = 0
    rows_skipped: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class Application(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    company: str = Field(max_length=200, index=True)
    role: str = Field(max_length=200)
    job_url: str = Field(default="", max_length=1000)
    job_description: str = ""
    contact_name: str = Field(default="", max_length=200)
    contact_email: str = Field(default="", max_length=320)
    location: str = Field(default="", max_length=200)
    salary: str = Field(default="", max_length=100)
    source: str = Field(default="manual", max_length=50)
    status: ApplicationStatus = Field(default=ApplicationStatus.IMPORTED, index=True)
    priority: int = Field(default=0, ge=0, le=3)
    notes: str = ""
    import_batch_id: int | None = Field(default=None, foreign_key="importbatch.id")
    applied_at: datetime | None = None
    last_contact_at: datetime | None = None
    follow_up_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CoverLetter(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(sa_column=_application_fk())
    content: str
    tone: str = Field(default="formal", max_length=50)
    model_used: str = Field(default="", max_length=100)
    version: int = 1
    created_at: datetime = Field(default_factory=utcnow)


class EmailLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(sa_column=_application_fk())
    to_address: str = Field(max_length=320)
    subject: str = Field(max_length=500)
    body: str
    attachments: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    status: EmailStatus = Field(default=EmailStatus.QUEUED)
    gmail_message_id: str = Field(default="", max_length=200)
    thread_id: str = Field(default="", max_length=200)
    sent_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


class StatusHistory(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(sa_column=_application_fk())
    from_status: ApplicationStatus | None = None
    to_status: ApplicationStatus
    changed_at: datetime = Field(default_factory=utcnow)
