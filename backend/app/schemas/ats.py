from typing import Literal

from pydantic import BaseModel


class AtsCheck(BaseModel):
    id: str
    label: str
    status: Literal["pass", "warn", "fail"]
    detail: str


class AtsReport(BaseModel):
    """How well applicant-tracking systems will read a CV (see services/ats_check.py)."""

    score: int  # 0-100
    level: Literal["good", "ok", "needs_work"]
    checks: list[AtsCheck]
    matched_keywords: list[str]
    missing_in_profile: list[str]  # in your profile but not in this CV: worth adding
    missing_gaps: list[str]  # the job wants them and your profile doesn't show them
