from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.application import DueItem


class FollowUpDraft(BaseModel):
    subject: str
    body: str
    source: Literal["ai", "template"]
    to: str  # the employer
    deliver_to: str  # where it will really go (you, in test mode)
    test_mode: bool


class FollowUpSend(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=5000)
    confirm: Literal[True]


class ReplyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    from_address: str
    subject: str
    snippet: str
    received_at: datetime
    classification: Literal["interview", "rejection", "other"]
    seen: bool


class ReplyCheckResult(BaseModel):
    checked: bool
    message: str
    new_replies: int
    checked_at: datetime | None


class NotificationSummary(BaseModel):
    unseen_replies: int
    follow_ups_due: int  # due today or overdue
    interviews_soon: int  # in the next 7 days
    last_reply_check: datetime | None
    # Tests, interviews and assessment centres today or in the next few days.
    upcoming: list[DueItem] = []


class CalendarEvent(BaseModel):
    date: datetime
    kind: Literal["follow_up", "interview", "stage", "deadline"]
    application_id: int
    company: str
    role: str
    label: str = ""  # e.g. "Online test" for a stage
    result: str = ""  # a stage's result: upcoming / passed / failed
