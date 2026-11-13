"""Find jobs on job boards, summarise them, and save the ones worth applying for."""

import threading
from collections import OrderedDict

from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import BadRequestError, NotFoundError
from app.integrations.ai import AIProvider
from app.integrations.jobs import AdzunaBoard, JobBoard, JobBoardError, Listing, ReedBoard
from app.models import Application, ApplicationStatus, StatusHistory
from app.repositories.application_repository import ApplicationRepository
from app.schemas.application import ApplicationRead
from app.schemas.jobs import JobDetailsRead, JobListingRead, JobSearchResult, JobSummary
from app.services.application_service import ApplicationService
from app.services.job_summary import summarize_job
from app.services.tailored_cv_service import load_profile

NO_AI = "AI isn't set up yet. Add your Gemini key in Settings to summarise jobs."
NOT_FOUND = "That job isn't in the latest search any more. Search again."


class ListingCache:
    """Recent search results, so opening or saving a job doesn't search again."""

    def __init__(self, size: int = 500):
        self.size = size
        self.items: OrderedDict[str, Listing] = OrderedDict()
        self.summaries: dict[str, JobSummary] = {}
        self.lock = threading.Lock()

    def put(self, listing: Listing) -> None:
        with self.lock:
            self.items[listing.id] = listing
            self.items.move_to_end(listing.id)
            while len(self.items) > self.size:
                old, _ = self.items.popitem(last=False)
                self.summaries.pop(old, None)

    def get(self, job_id: str) -> Listing | None:
        with self.lock:
            return self.items.get(job_id)


CACHE = ListingCache()


def build_boards(env: Settings) -> list[JobBoard]:
    boards: list[JobBoard] = []
    if env.reed_api_key:
        boards.append(ReedBoard(env.reed_api_key, base=env.reed_api_base))
    if env.adzuna_app_id and env.adzuna_app_key:
        boards.append(AdzunaBoard(env.adzuna_app_id, env.adzuna_app_key))
    return boards


class JobService:
    def __init__(
        self,
        session: Session,
        boards: list[JobBoard],
        ai: AIProvider | None = None,
        cache: ListingCache = CACHE,
    ):
        self.session = session
        self.boards = boards
        self.ai = ai
        self.cache = cache

    def search(self, query: str, location: str, graduate: bool, page: int) -> JobSearchResult:
        if not self.boards:
            return JobSearchResult(jobs=[], boards=[], problems=[], needs_setup=True)
        listings: list[Listing] = []
        problems: list[str] = []
        for board in self.boards:
            try:
                listings += board.search(query.strip(), location.strip(), graduate, page)
            except JobBoardError as exc:
                problems.append(str(exc))
        listings = _without_duplicates(listings)
        for listing in listings:
            self.cache.put(listing)
        saved = self._saved_ids([listing.id for listing in listings])
        return JobSearchResult(
            jobs=[self._read(listing, saved.get(listing.id)) for listing in listings],
            boards=[board.label for board in self.boards],
            problems=problems,
            needs_setup=False,
        )

    def details(self, job_id: str) -> JobDetailsRead:
        listing = self._listing(job_id)
        board = next((b for b in self.boards if b.name == listing.source), None)
        if board and not listing.description:
            try:
                board.details(listing)
            except JobBoardError:
                listing.description = listing.snippet  # still show what we have
        saved = self._saved_ids([job_id])
        return JobDetailsRead(
            **self._read(listing, saved.get(job_id)).model_dump(),
            description=listing.description or listing.snippet,
            work_type=listing.extra.get("work_type", ""),
            summary=self.cache.summaries.get(job_id),
        )

    def summarize(self, job_id: str) -> JobDetailsRead:
        details = self.details(job_id)
        if self.ai is None:
            raise BadRequestError(NO_AI)
        summary = self._summarize(
            title=details.title,
            company=details.company,
            location=details.location,
            salary=details.salary,
            description=details.description,
        )
        if not summary.work_type and details.work_type:
            summary.work_type = details.work_type
        self.cache.summaries[job_id] = summary
        return details.model_copy(update={"summary": summary})

    def save(self, job_id: str) -> ApplicationRead:
        """Adds a found job to the tracker (or returns it if it's already there)."""
        applications = ApplicationService(self.session)
        existing = self._saved_ids([job_id]).get(job_id)
        if existing:
            return applications.to_read([applications.get(existing)])[0]
        details = self.details(job_id)
        summary = self.cache.summaries.get(job_id)
        application = Application(
            company=details.company[:200] or "Unknown company",
            role=details.title[:200] or "Unknown role",
            job_url=details.url[:1000],
            job_description=details.description,
            location=details.location[:200],
            salary=details.salary[:100],
            source=details.source,
            external_id=job_id[:100],
            application_deadline=details.closes[:100],
            job_summary=summary.model_dump() if summary else {},
            status=ApplicationStatus.IMPORTED,
        )
        ApplicationRepository(self.session).add_many([application])
        self.session.add(StatusHistory(application_id=application.id, to_status=application.status))
        self.session.commit()
        self.session.refresh(application)
        return applications.to_read([application])[0]

    def summarize_application(self, application_id: int) -> ApplicationRead:
        """The same plain-English summary for a job already in the tracker."""
        applications = ApplicationService(self.session)
        application = applications.get(application_id)
        if self.ai is None:
            raise BadRequestError(NO_AI)
        if not application.job_description.strip():
            raise BadRequestError(
                "This job has no description yet. Paste the job ad into Details first."
            )
        summary = self._summarize(
            title=application.role,
            company=application.company,
            location=application.location,
            salary=application.salary,
            description=application.job_description,
        )
        application.job_summary = summary.model_dump()
        if not application.salary and summary.salary and summary.salary != "Not stated":
            application.salary = summary.salary[:100]
        self.session.add(application)
        self.session.commit()
        self.session.refresh(application)
        return applications.to_read([application])[0]

    def _summarize(self, **job: str) -> JobSummary:
        assert self.ai is not None
        return summarize_job(self.ai, load_profile(self.session), **job)  # may raise AIError

    def _listing(self, job_id: str) -> Listing:
        listing = self.cache.get(job_id)
        if listing is None:
            raise NotFoundError("Job", job_id)  # type: ignore[arg-type]
        return listing

    def _saved_ids(self, job_ids: list[str]) -> dict[str, int]:
        if not job_ids:
            return {}
        rows = self.session.exec(
            select(Application.external_id, Application.id).where(
                Application.external_id.in_(job_ids)  # type: ignore[attr-defined]
            )
        ).all()
        return {external_id: app_id for external_id, app_id in rows}

    @staticmethod
    def _read(listing: Listing, application_id: int | None) -> JobListingRead:
        return JobListingRead(
            id=listing.id,
            source=listing.source,
            title=listing.title,
            company=listing.company,
            location=listing.location,
            salary=listing.salary,
            posted=listing.posted,
            closes=listing.closes,
            snippet=listing.snippet[:600],
            url=listing.url,
            application_id=application_id,
        )


def _without_duplicates(listings: list[Listing]) -> list[Listing]:
    """The same job is often on both boards: keep the first."""
    seen: set[tuple[str, str]] = set()
    result = []
    for listing in listings:
        key = (listing.company.casefold().strip(), listing.title.casefold().strip())
        if key not in seen:
            seen.add(key)
            result.append(listing)
    return result
