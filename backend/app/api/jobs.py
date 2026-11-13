"""Find jobs on job boards, read an AI summary, and save them to the tracker."""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import JobServiceDep
from app.schemas.application import ApplicationRead
from app.schemas.jobs import JobDetailsRead, JobListingRead, JobSearchResult, PastedJob

router = APIRouter(tags=["jobs"])

JobId = Annotated[str, Query(pattern=r"^(reed|adzuna|jooble|saved):[\w-]{1,60}$")]


@router.get("/jobs/search", response_model=JobSearchResult)
def search_jobs(
    service: JobServiceDep,
    q: Annotated[str, Query(min_length=2, max_length=100)],
    location: Annotated[str, Query(max_length=100)] = "",
    graduate: bool = True,
    page: Annotated[int, Query(ge=1, le=20)] = 1,
) -> JobSearchResult:
    return service.search(q, location, graduate, page)


@router.get("/jobs/details", response_model=JobDetailsRead)
def job_details(id: JobId, service: JobServiceDep) -> JobDetailsRead:
    return service.details(id)


@router.post("/jobs/summary", response_model=JobDetailsRead)
def summarize_job(id: JobId, service: JobServiceDep) -> JobDetailsRead:
    return service.summarize(id)


@router.post("/jobs/save", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def save_job(id: JobId, service: JobServiceDep) -> ApplicationRead:
    """Adds the job to your tracker so you can tailor a CV and letter for it."""
    return service.save(id)


@router.get("/jobs/shortlist", response_model=list[JobListingRead])
def get_shortlist(service: JobServiceDep) -> list[JobListingRead]:
    return service.shortlist()


@router.post("/jobs/shortlist", response_model=JobListingRead, status_code=status.HTTP_201_CREATED)
def add_to_shortlist(id: JobId, service: JobServiceDep) -> JobListingRead:
    """Stars a job to look at later, without adding it to the tracker."""
    return service.add_to_shortlist(id)


@router.delete("/jobs/shortlist", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_shortlist(id: JobId, service: JobServiceDep) -> None:
    service.remove_from_shortlist(id)


@router.post("/jobs/paste", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def add_pasted_job(job: PastedJob, service: JobServiceDep) -> ApplicationRead:
    """A job from any website: paste its link and the text of the ad."""
    return service.add_from_text(job)


@router.post("/applications/{application_id}/summary", response_model=ApplicationRead)
def summarize_application(application_id: int, service: JobServiceDep) -> ApplicationRead:
    return service.summarize_application(application_id)
