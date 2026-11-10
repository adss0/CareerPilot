"""Writes many cover letters in the background, one at a time, within free-tier rate limits."""

import queue
import threading
import time
import uuid
from collections.abc import Callable
from datetime import datetime

from sqlmodel import Session

from app.core.errors import BadRequestError, NotFoundError
from app.integrations.ai import AIError, AIProvider, AIRateLimitError
from app.models.tables import utcnow
from app.schemas.letters import BulkFailure, BulkLetterRequest, LetterJobRead
from app.services.application_service import ApplicationService
from app.services.letter_service import LetterService

RATE_LIMIT_RETRIES = 3
RATE_LIMIT_WAIT_SECONDS = 15  # doubles on each retry: 15s, 30s, 60s
MAX_KEPT_JOBS = 20


class LetterJob:
    def __init__(self, request: BulkLetterRequest):
        self.id = uuid.uuid4().hex
        self.request = request
        self.status = "queued"
        self.processed = 0
        self.succeeded: list[int] = []
        self.skipped: list[int] = []
        self.failed: list[BulkFailure] = []
        self.current: str | None = None
        self.message: str | None = None
        self.cancel_requested = False
        self.created_at: datetime = utcnow()

    def read(self) -> LetterJobRead:
        return LetterJobRead(
            id=self.id,
            status=self.status,
            total=len(self.request.application_ids),
            processed=self.processed,
            succeeded=list(self.succeeded),
            skipped=list(self.skipped),
            failed=list(self.failed),
            current=self.current,
            message=self.message,
            created_at=self.created_at,
        )


class LetterQueue:
    def __init__(
        self,
        session_factory: Callable[[], Session],
        ai_factory: Callable[[Session], AIProvider | None],
        gap_factory: Callable[[Session], float],
        sleep: Callable[[float], None] = time.sleep,
        run_inline: bool = False,  # tests: run jobs immediately instead of in a thread
    ):
        self.session_factory = session_factory
        self.ai_factory = ai_factory
        self.gap_factory = gap_factory
        self.sleep = sleep
        self.run_inline = run_inline
        self._jobs: dict[str, LetterJob] = {}
        self._pending: queue.Queue[LetterJob] = queue.Queue()
        self._lock = threading.Lock()
        self._worker: threading.Thread | None = None

    def submit(self, request: BulkLetterRequest) -> LetterJobRead:
        job = LetterJob(request)
        with self._lock:
            self._jobs[job.id] = job
            for old_id in list(self._jobs)[:-MAX_KEPT_JOBS]:
                if self._jobs[old_id].status not in ("queued", "running"):
                    del self._jobs[old_id]
        if self.run_inline:
            self._run(job)
        else:
            self._pending.put(job)
            self._ensure_worker()
        return job.read()

    def get(self, job_id: str) -> LetterJobRead:
        return self._job(job_id).read()

    def cancel(self, job_id: str) -> LetterJobRead:
        job = self._job(job_id)
        job.cancel_requested = True
        if job.status == "queued":
            job.status = "cancelled"
        return job.read()

    def _job(self, job_id: str) -> LetterJob:
        job = self._jobs.get(job_id)
        if job is None:
            raise BadRequestError("That letter-writing job wasn't found. It may have expired.")
        return job

    def _ensure_worker(self) -> None:
        with self._lock:
            if self._worker is None or not self._worker.is_alive():
                self._worker = threading.Thread(target=self._work, name="letter-queue", daemon=True)
                self._worker.start()

    def _work(self) -> None:
        while True:
            job = self._pending.get()
            try:
                self._run(job)
            except Exception as exc:  # never let one job kill the worker
                job.status = "failed"
                job.message = f"Unexpected error: {exc}"

    def _run(self, job: LetterJob) -> None:
        if job.status == "cancelled":
            return
        job.status = "running"
        request = job.request
        called_ai = False

        for application_id in request.application_ids:
            if job.cancel_requested:
                job.status = "cancelled"
                job.current = None
                return
            with self.session_factory() as session:
                ai = self.ai_factory(session)
                service = LetterService(session, ai)
                try:
                    application = ApplicationService(session).get(application_id)
                except NotFoundError:
                    job.failed.append(
                        BulkFailure(application_id=application_id, error="Not found.")
                    )
                    job.processed += 1
                    continue
                job.current = f"{application.company}: {application.role}"

                if request.skip_existing and service.has_letters(application_id):
                    job.skipped.append(application_id)
                    job.processed += 1
                    continue

                if called_ai:
                    self.sleep(self.gap_factory(session))  # stay inside free-tier limits
                called_ai = True

                error = self._generate_with_retries(job, service, application_id)
                job.processed += 1
                if error is None:
                    job.succeeded.append(application_id)
                elif isinstance(error, BadRequestError):
                    # Not set up / empty profile: every other letter would fail the same way.
                    job.status, job.message, job.current = "failed", str(error), None
                    return
                else:
                    job.failed.append(
                        BulkFailure(
                            application_id=application_id,
                            company=application.company,
                            error=str(error),
                        )
                    )

        job.status = "done"
        job.current = None

    def _generate_with_retries(
        self, job: LetterJob, service: LetterService, application_id: int
    ) -> Exception | None:
        for attempt in range(RATE_LIMIT_RETRIES + 1):
            try:
                service.generate(application_id, job.request.tone, job.request.instructions)
                return None
            except AIRateLimitError as exc:
                if attempt == RATE_LIMIT_RETRIES or job.cancel_requested:
                    return exc
                wait = RATE_LIMIT_WAIT_SECONDS * 2**attempt
                job.message = f"Rate limit reached, waiting {wait}s before retrying…"
                self.sleep(wait)
                job.message = None
            except (AIError, BadRequestError, NotFoundError) as exc:
                return exc
        return None
