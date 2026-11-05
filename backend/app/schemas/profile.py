from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ProfileUpdate(BaseModel):
    """Every field is optional: only the fields sent are changed."""

    full_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=200)
    linkedin_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    summary: str | None = None
    skills: list[str] | None = None

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email(cls, value):
        return None if value == "" else value


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    email: str
    phone: str
    location: str
    linkedin_url: str
    github_url: str
    portfolio_url: str
    summary: str
    skills: list[str]
    has_cv: bool
    updated_at: datetime
