from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ExperienceItem(BaseModel):
    title: str = Field(default="", max_length=200)
    company: str = Field(default="", max_length=200)
    start: str = Field(default="", max_length=50)
    end: str = Field(default="", max_length=50)
    summary: str = Field(default="", max_length=3000)


class EducationItem(BaseModel):
    qualification: str = Field(default="", max_length=200)
    institution: str = Field(default="", max_length=200)
    start: str = Field(default="", max_length=50)
    end: str = Field(default="", max_length=50)
    details: str = Field(default="", max_length=2000)


class ProjectItem(BaseModel):
    name: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=2000)
    link: str = Field(default="", max_length=500)


class ProfileDetails(BaseModel):
    """Everything about the user that the AI may use. Also what CV parsing produces."""

    full_name: str = Field(default="", max_length=200)
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=50)
    location: str = Field(default="", max_length=200)
    linkedin_url: str = Field(default="", max_length=500)
    github_url: str = Field(default="", max_length=500)
    portfolio_url: str = Field(default="", max_length=500)
    summary: str = Field(default="", max_length=5000)
    skills: list[str] = Field(default_factory=list, max_length=100)
    experience: list[ExperienceItem] = Field(default_factory=list, max_length=30)
    education: list[EducationItem] = Field(default_factory=list, max_length=20)
    projects: list[ProjectItem] = Field(default_factory=list, max_length=30)


class ProfileUpdate(BaseModel):
    """Every field is optional: only the fields sent are changed."""

    full_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=200)
    linkedin_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    summary: str | None = Field(default=None, max_length=5000)
    skills: list[str] | None = Field(default=None, max_length=100)
    experience: list[ExperienceItem] | None = Field(default=None, max_length=30)
    education: list[EducationItem] | None = Field(default=None, max_length=20)
    projects: list[ProjectItem] | None = Field(default=None, max_length=30)
    main_cover_letter: str | None = Field(default=None, max_length=10_000)

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email(cls, value):
        return None if value == "" else value


class ProfileRead(ProfileDetails):
    model_config = ConfigDict(from_attributes=True)

    has_cv: bool
    # The user's own cover letter. New letters follow its structure and voice.
    main_cover_letter: str = ""
    updated_at: datetime
