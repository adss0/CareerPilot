from pydantic import BaseModel, Field


class JobSummary(BaseModel):
    """The AI's plain-English summary of a job, and how well the user's profile fits it."""

    summary: str = ""
    salary: str = ""
    location: str = ""
    work_type: str = ""
    requirements: list[str] = Field(default_factory=list)
    nice_to_have: list[str] = Field(default_factory=list)
    match_score: int | None = None
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class JobListingRead(BaseModel):
    id: str
    source: str
    title: str
    company: str
    location: str
    salary: str
    posted: str
    closes: str
    snippet: str
    url: str
    application_id: int | None = None  # already saved to the tracker
    shortlisted: bool = False  # starred to look at later


class JobSearchResult(BaseModel):
    jobs: list[JobListingRead]
    boards: list[str]  # boards that were searched
    problems: list[str]  # e.g. a board that couldn't be reached
    needs_setup: bool  # no job board key yet


class PastedJob(BaseModel):
    """A job from any website (Gradcracker, The Trackr, a company's careers page...)."""

    url: str = Field(default="", max_length=1000)
    text: str = Field(min_length=20, max_length=30_000)  # the job ad, copied from the page
    company: str = Field(default="", max_length=200)  # needed when AI isn't set up
    role: str = Field(default="", max_length=200)


class JobDetailsRead(JobListingRead):
    description: str
    work_type: str = ""
    summary: JobSummary | None = None
