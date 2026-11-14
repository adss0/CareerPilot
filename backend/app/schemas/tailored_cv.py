from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ats import AtsReport
from app.schemas.profile import EducationItem, ExperienceItem, ProjectItem

CvStyle = Literal["own", "jake"]


class TailoredContent(BaseModel):
    """A CV's body for one job. Name and contact details always come from the profile."""

    summary: str = Field(default="", max_length=5000)
    skills: list[str] = Field(default_factory=list, max_length=100)
    experience: list[ExperienceItem] = Field(default_factory=list, max_length=30)
    education: list[EducationItem] = Field(default_factory=list, max_length=20)
    projects: list[ProjectItem] = Field(default_factory=list, max_length=30)


class TailoredCvRead(BaseModel):
    application_id: int
    content: TailoredContent
    changes: list[str]
    flags: list[str]
    model_used: str
    edited: bool
    created_at: datetime
    updated_at: datetime | None
    ats: AtsReport | None = None  # how applicant-tracking systems will read it
    style: CvStyle = "jake"
    source_cv_id: int | None = None  # the uploaded CV it was based on
    pages: int = 1


class TailoredCvUpdate(BaseModel):
    content: TailoredContent
    style: CvStyle | None = None


class TailorRequest(BaseModel):
    """Which uploaded CV to base it on (None = the main one) and which layout."""

    cv_id: int | None = None
    style: CvStyle | None = None
