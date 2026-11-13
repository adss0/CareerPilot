from pydantic import ValidationError
from sqlmodel import Session

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.integrations.email.smtp import EmailError
from app.models import AppSetting
from app.schemas.email import (
    LOCAL_HOSTS,
    ConnectionTestResult,
    EmailSettings,
    EmailSettingsRead,
    EmailSettingsUpdate,
)

SETTINGS_KEY = "email"


class EmailSettingsService:
    def __init__(self, session: Session, env: Settings):
        self.session = session
        self.env = env

    @property
    def password(self) -> str:
        return self.env.email_password

    def settings(self) -> EmailSettings:
        row = self.session.get(AppSetting, SETTINGS_KEY)
        try:
            return EmailSettings(**(row.value if row else {}))
        except ValidationError:
            return EmailSettings()  # stored values became invalid: fall back to safe defaults

    def problems(self, settings: EmailSettings | None = None) -> list[str]:
        settings = settings or self.settings()
        problems = []
        if not settings.from_address:
            problems.append("Add your email address (the 'From' address).")
        local = settings.smtp_host.strip().lower() in LOCAL_HOSTS
        if not self.password and not local:
            problems.append("Add your email App Password in Settings → Keys & passwords.")
        if not settings.smtp_host.strip():
            problems.append("Add the SMTP server (smtp.gmail.com for Gmail).")
        return problems

    def get(self) -> EmailSettingsRead:
        settings = self.settings()
        problems = self.problems(settings)
        return EmailSettingsRead(
            **settings.model_dump(),
            password_set=bool(self.password),
            ready=not problems,
            problems=problems,
        )

    def update(self, data: EmailSettingsUpdate) -> EmailSettingsRead:
        merged = {**self.settings().model_dump(), **data.model_dump(exclude_unset=True)}
        try:
            settings = EmailSettings(**merged)
        except ValidationError as exc:
            message = exc.errors()[0]["msg"].removeprefix("Value error, ")
            raise BadRequestError(message) from exc
        row = self.session.get(AppSetting, SETTINGS_KEY) or AppSetting(key=SETTINGS_KEY)
        row.value = settings.model_dump(mode="json")
        self.session.add(row)
        self.session.commit()
        return self.get()

    def test_connection(self, check_login) -> ConnectionTestResult:
        problems = self.problems()
        if problems:
            return ConnectionTestResult(ok=False, message=problems[0])
        try:
            check_login(self.settings(), self.password)
        except EmailError as exc:
            return ConnectionTestResult(ok=False, message=str(exc))
        return ConnectionTestResult(ok=True, message="Connected and logged in. Ready to send.")
