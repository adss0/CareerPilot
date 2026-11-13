from datetime import date, datetime
from datetime import date as Day
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.enums import ApplicationStatus

StageKind = Literal[
    "online_test", "video", "phone", "technical", "assessment_centre", "final", "other"
]
STAGE_LABELS: dict[str, str] = {
    "online_test": "Online test",
    "video": "Video interview",
    "phone": "Phone screen",
    "technical": "Technical interview",
    "assessment_centre": "Assessment centre",
    "final": "Final interview",
    "other": "Other",
}


class Stage(BaseModel):
    """One step of the hiring process, e.g. an online test or an assessment centre."""

    kind: StageKind
    date: Day | None = None  # (the field is called date, so the type is aliased)
    result: Literal["upcoming", "passed", "failed"] = "upcoming"
    note: str = Field(default="", max_length=100)  # e.g. a name for "other", or a time


def _blank_to_none(value):
    # Treat "" as "not provided" so optional email fields don't fail validation.
    return None if value == "" else value


class ApplicationBase(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    job_url: str = Field(default="", max_length=1000)
    job_description: str = ""
    contact_name: str = Field(default="", max_length=200)
    contact_email: EmailStr | None = None
    location: str = Field(default="", max_length=200)
    salary: str = Field(default="", max_length=100)
    source: str = Field(default="manual", max_length=50)
    priority: int = Field(default=0, ge=0, le=3)
    notes: str = ""
    follow_up_at: datetime | None = None
    interview_at: datetime | None = None
    cv_id: int | None = None  # which CV to send; None = use the default CV
    application_deadline: str = Field(default="", max_length=100)
    stages: list[Stage] = Field(default_factory=list, max_length=20)

    _clean_email = field_validator("contact_email", mode="before")(_blank_to_none)


class ApplicationCreate(ApplicationBase):
    status: ApplicationStatus = ApplicationStatus.IMPORTED


class ApplicationUpdate(BaseModel):
    """Every field is optional: only the fields sent are changed."""

    company: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(default=None, min_length=1, max_length=200)
    job_url: str | None = Field(default=None, max_length=1000)
    job_description: str | None = None
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: EmailStr | None = None
    location: str | None = Field(default=None, max_length=200)
    salary: str | None = Field(default=None, max_length=100)
    source: str | None = Field(default=None, max_length=50)
    status: ApplicationStatus | None = None
    priority: int | None = Field(default=None, ge=0, le=3)
    notes: str | None = None
    applied_at: datetime | None = None
    last_contact_at: datetime | None = None
    follow_up_at: datetime | None = None
    interview_at: datetime | None = None
    cv_id: int | None = None
    application_deadline: str | None = Field(default=None, max_length=100)
    stages: list[Stage] | None = Field(default=None, max_length=20)

    _clean_email = field_validator("contact_email", mode="before")(_blank_to_none)


class ApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company: str
    role: str
    job_url: str
    job_description: str
    contact_name: str
    contact_email: str
    location: str
    salary: str
    source: str
    status: ApplicationStatus
    priority: int
    notes: str
    import_batch_id: int | None
    cv_id: int | None
    applied_at: datetime | None
    last_contact_at: datetime | None
    follow_up_at: datetime | None
    interview_at: datetime | None
    created_at: datetime
    updated_at: datetime
    application_deadline: str
    stages: list[Stage]
    external_id: str
    job_summary: dict
    letter_count: int = 0
    match_score: int | None = None  # from the selected cover letter
    next_step: str = ""  # what to do next, worked out from the status and the assessment
    due_label: str = ""  # e.g. "Closes in 3 days", "Assessment due tomorrow"
    due_level: Literal["", "soon", "overdue"] = ""


class BinItem(BaseModel):
    id: int
    company: str
    role: str
    status: str
    deleted_at: datetime
    expires_at: datetime  # removed for good after this


class DeleteAll(BaseModel):
    confirm: Literal["DELETE"]  # typed by the user, so it can't happen by accident


class DeleteAllResult(BaseModel):
    deleted: int
    backup: str  # the backup made first


class DueItem(BaseModel):
    application_id: int
    company: str
    role: str
    kind: Literal["deadline", "stage"]
    date: date
    days_left: int  # negative: overdue
    label: str


class TrackerSummary(BaseModel):
    """The totals above the tracker, like the top of a job-hunt spreadsheet."""

    total: int
    to_apply: int
    applied: int
    in_progress: int
    assessments_done: int
    interviews: int
    offers: int
    rejected: int


class ApplicationPage(BaseModel):
    items: list[ApplicationRead]
    total: int
    limit: int
    offset: int


class StatusHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    changed_at: datetime


class BulkApplicationAction(BaseModel):
    application_ids: list[int] = Field(min_length=1, max_length=500)
    action: Literal["set_status", "delete"]
    status: ApplicationStatus | None = None

    @model_validator(mode="after")
    def _status_needed(self):
        if self.action == "set_status" and self.status is None:
            raise ValueError("status is required for set_status")
        return self


class BulkApplicationResult(BaseModel):
    affected: int
    missing: list[int]
