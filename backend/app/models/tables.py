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


def _json_list() -> Column:
    return Column(JSON, nullable=False, server_default="[]")


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
    skills: list[str] = Field(default_factory=list, sa_column=_json_list())
    # Lists of small dicts; shapes are defined in app/schemas/profile.py
    experience: list[dict] = Field(default_factory=list, sa_column=_json_list())
    education: list[dict] = Field(default_factory=list, sa_column=_json_list())
    projects: list[dict] = Field(default_factory=list, sa_column=_json_list())
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CvDocument(SQLModel, table=True):
    """An uploaded CV. The file lives in the data folder under a random name."""

    id: int | None = Field(default=None, primary_key=True)
    label: str = Field(max_length=100)
    original_filename: str = Field(max_length=200)
    stored_name: str = Field(max_length=100, unique=True)
    content_type: str = Field(max_length=100)
    size_bytes: int
    text: str = ""
    is_default: bool = False
    created_at: datetime = Field(default_factory=utcnow)


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
    # Which CV to send with this application; cleared if that CV is deleted.
    cv_id: int | None = Field(
        default=None,
        sa_column=Column(
            Integer,
            ForeignKey("cvdocument.id", ondelete="SET NULL", name="fk_application_cv_id"),
            nullable=True,
            index=True,
        ),
    )
    applied_at: datetime | None = None
    last_contact_at: datetime | None = None
    follow_up_at: datetime | None = None
    interview_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CoverLetter(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(sa_column=_application_fk())
    content: str
    tone: str = Field(default="formal", max_length=50)
    model_used: str = Field(default="", max_length=100)
    version: int = 1
    email_subject: str = Field(default="", max_length=300, sa_column_kwargs={"server_default": ""})
    email_body: str = Field(default="", sa_column_kwargs={"server_default": ""})
    match_score: int | None = None  # 0–100: how well the profile fits the job, per the AI
    # The AI's reasoning: {"requirements": [...], "matches": [{"requirement", "evidence"}]}
    analysis: dict = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False, server_default="{}")
    )
    flags: list[str] = Field(default_factory=list, sa_column=_json_list())  # things to check
    is_selected: bool = Field(default=False, sa_column_kwargs={"server_default": "0"})
    edited: bool = Field(default=False, sa_column_kwargs={"server_default": "0"})
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime | None = None


class TailoredCv(SQLModel, table=True):
    """The user's CV reworded and reordered for one job. One per application."""

    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("application.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        )
    )
    # {"summary", "skills": [...], "experience": [...], "projects": [...], "education": [...]}
    # in the shapes of app/schemas/profile.py; contact details always come from the profile.
    content: dict = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False, server_default="{}")
    )
    changes: list[str] = Field(default_factory=list, sa_column=_json_list())  # what the AI changed
    flags: list[str] = Field(default_factory=list, sa_column=_json_list())  # things to check
    model_used: str = Field(default="", max_length=100)
    edited: bool = Field(default=False, sa_column_kwargs={"server_default": "0"})
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime | None = None


class InboxReply(SQLModel, table=True):
    """A reply found in the user's inbox that answers one of their application emails."""

    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(sa_column=_application_fk())
    email_log_id: int | None = Field(default=None, foreign_key="emaillog.id")
    message_id: str = Field(max_length=300, unique=True)  # the reply's own Message-ID
    from_address: str = Field(max_length=320)
    subject: str = Field(default="", max_length=500)
    snippet: str = Field(default="", max_length=1000)  # start of the reply, kept on this computer
    received_at: datetime
    # "interview", "rejection" or "other": a suggestion only; the user decides the status
    classification: str = Field(default="other", max_length=20)
    seen: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class AppSetting(SQLModel, table=True):
    """Small app-wide settings chosen in the UI (never secrets: API keys stay in .env)."""

    key: str = Field(primary_key=True, max_length=50)
    value: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class EmailLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(sa_column=_application_fk())
    to_address: str = Field(max_length=320)
    subject: str = Field(max_length=500)
    body: str
    attachments: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    status: EmailStatus = Field(default=EmailStatus.QUEUED)
    # "application" or "follow_up"
    kind: str = Field(
        default="application", max_length=20, sa_column_kwargs={"server_default": "application"}
    )
    # Test mode: sent to the user's own address instead of the employer.
    is_test: bool = Field(default=False, sa_column_kwargs={"server_default": "0"})
    message_id: str = Field(default="", max_length=200)  # our Message-ID, to match replies
    in_reply_to: str = Field(default="", max_length=200)  # for follow-ups in the same thread
    error: str = Field(default="", max_length=500, sa_column_kwargs={"server_default": ""})
    sent_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


class StatusHistory(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(sa_column=_application_fk())
    from_status: ApplicationStatus | None = None
    to_status: ApplicationStatus
    changed_at: datetime = Field(default_factory=utcnow)
