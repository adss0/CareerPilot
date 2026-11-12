from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ApplicationStatus


class WeekCount(BaseModel):
    week_start: str  # ISO date of the Monday
    count: int


class FollowUpDue(BaseModel):
    id: int
    company: str
    role: str
    follow_up_at: datetime
    overdue: bool


class Breakdown(BaseModel):
    label: str
    sent: int
    responses: int
    rate: float | None


class StatsRead(BaseModel):
    total: int
    by_status: dict[ApplicationStatus, int]
    added_this_week: int
    sent: int  # applications that have gone out (sent or any later stage)
    responses: int  # interviews, offers and rejections
    interviews: int
    response_rate: float | None  # responses / sent, None until something is sent
    added_per_week: list[WeekCount]  # last 8 weeks, oldest first
    follow_ups_due: list[FollowUpDue]  # due within the next 7 days
    avg_days_to_reply: float | None  # from real (not test) emails that got a reply
    by_tone: list[Breakdown]  # response rate by the tone of the letter you sent
    by_cv: list[Breakdown]  # response rate by which CV you sent
