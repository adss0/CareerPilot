from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.profile import ProfileDetails


class CvRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    original_filename: str
    content_type: str
    size_bytes: int
    is_default: bool
    has_text: bool
    created_at: datetime


class CvUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=100)
    is_default: Literal[True] | None = None  # make this the default CV


class CvParseResult(BaseModel):
    """Details read from a CV, for the user to review before saving to their profile."""

    cv: CvRead
    details: ProfileDetails
    parser: Literal["basic", "ai"]
    warnings: list[str]
