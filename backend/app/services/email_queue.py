"""Sends queued emails in the background: one at a time, a daily cap, random gaps between."""

import random
import threading
from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path

from sqlmodel import Session, col, func, select

from app.core.config import Settings
from app.integrations.email.smtp import EmailError, send_message
from app.models import EmailLog, EmailStatus
from app.models.tables import utcnow
from app.schemas.email import QueueStatus
from app.services.email_service import EmailService
from app.services.email_settings_service import EmailSettingsService


def _naive(value: datetime) -> datetime:
    return value.replace(tzinfo=None) if value.tzinfo else value


class EmailQueue:
    def __init__(
        self,
        session_factory: Callable[[], Session],
        env: Settings,
        cv_dir: Path,
        sender: Callable = send_message,
        now: Callable[[], datetime] = utcnow,
        gap: Callable[[float, float], float] = random.uniform,
    ):
        self.session_factory = session_factory
        self.env = env
        self.cv_dir = cv_dir
        self.sender = sender
        self.now = now
        self.gap = gap
        self.next_allowed_at: datetime | None = None
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    def _sent_today(self, session: Session) -> int:
        start = _naive(self.now()).replace(hour=0, minute=0, second=0, microsecond=0)
        return session.exec(
            select(func.count())
            .select_from(EmailLog)
            .where(col(EmailLog.status) == EmailStatus.SENT, col(EmailLog.sent_at) >= start)
        ).one()

    def status(self, session: Session) -> QueueStatus:
        settings_service = EmailSettingsService(session, self.env)
        settings = settings_service.settings()
        problems = settings_service.problems(settings)
        queued = session.exec(
            select(func.count()).select_from(EmailLog).where(EmailLog.status == EmailStatus.QUEUED)
        ).one()
        return QueueStatus(
            ready=not problems,
            problems=problems,
            queued=queued,
            sent_today=self._sent_today(session),
            daily_limit=settings.daily_limit,
            test_mode=settings.test_mode,
            next_send_at=self.next_allowed_at if queued else None,
        )

    def tick(self) -> str:
        """Sends at most one email. Returns what happened (for tests and logs)."""
        with self._lock, self.session_factory() as session:
            settings_service = EmailSettingsService(session, self.env)
            settings = settings_service.settings()
            if settings_service.problems(settings):
                return "not_ready"
            log = session.exec(
                select(EmailLog)
                .where(EmailLog.status == EmailStatus.QUEUED)
                .order_by(col(EmailLog.created_at), col(EmailLog.id))
                .limit(1)
            ).first()
            if log is None:
                return "idle"
            if self._sent_today(session) >= settings.daily_limit:
                return "daily_limit"
            now = _naive(self.now())
            if self.next_allowed_at and now < _naive(self.next_allowed_at):
                return "waiting"

            service = EmailService(session, self.env, self.cv_dir)
            try:
                message = service.build_for_send(log)
                self.sender(settings, settings_service.password, message)
            except EmailError as exc:
                service.mark_failed(log, str(exc))
                self.next_allowed_at = now + timedelta(seconds=settings.min_gap_seconds)
                return "failed"
            except Exception as exc:  # e.g. the job was deleted while queued
                service.mark_failed(log, f"Couldn't prepare the email: {exc}")
                return "failed"

            service.mark_sent(log)
            gap = self.gap(settings.min_gap_seconds, settings.max_gap_seconds)
            self.next_allowed_at = now + timedelta(seconds=gap)
            return "sent"

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="email-queue", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:  # keep the worker alive; the next tick tries again
                pass
            self._stop.wait(self.env.email_queue_interval_seconds)
