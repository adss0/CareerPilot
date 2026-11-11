from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Tone = Literal["formal", "friendly", "enthusiastic"]


class LetterMatch(BaseModel):
    requirement: str
    evidence: str


class LetterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    version: int
    tone: str
    model_used: str
    content: str
    email_subject: str
    email_body: str
    match_score: int | None
    requirements: list[str]
    matches: list[LetterMatch]
    flags: list[str]
    is_selected: bool
    edited: bool
    created_at: datetime
    updated_at: datetime | None


class LetterGenerate(BaseModel):
    tone: Tone = "formal"
    instructions: str = Field(default="", max_length=500)  # e.g. "mention I can start in June"


class LetterUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=10_000)
    email_subject: str | None = Field(default=None, max_length=300)
    email_body: str | None = Field(default=None, max_length=3000)
    is_selected: Literal[True] | None = None  # use this version


class BulkLetterRequest(BaseModel):
    application_ids: list[int] = Field(min_length=1, max_length=200)
    tone: Tone = "formal"
    instructions: str = Field(default="", max_length=500)
    skip_existing: bool = True  # don't rewrite letters for applications that already have one


class BulkFailure(BaseModel):
    application_id: int
    company: str = ""
    error: str


class LetterJobRead(BaseModel):
    id: str
    status: Literal["queued", "running", "done", "cancelled", "failed"]
    total: int
    processed: int
    succeeded: list[int]
    skipped: list[int]
    failed: list[BulkFailure]
    current: str | None
    message: str | None
    created_at: datetime
