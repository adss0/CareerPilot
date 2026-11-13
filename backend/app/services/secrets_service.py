"""Saves API keys and the email password to the .env file, never to the database.

The values are write-only: the API only ever says whether one is set, never what it is.
Saving one also updates the running app's settings, so no restart is needed.
"""

import os
import re
from pathlib import Path

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.schemas.settings import SecretName, SecretsStatus

# Which .env variable and Settings field holds each secret.
SECRETS: dict[str, tuple[str, str]] = {
    "gemini": ("GEMINI_API_KEY", "gemini_api_key"),
    "groq": ("GROQ_API_KEY", "groq_api_key"),
    "email": ("EMAIL_PASSWORD", "email_password"),
}
VALUE_RE = re.compile(r"^[\x21-\x7e]{1,500}$")  # printable, no spaces, quotes are checked below


class SecretsService:
    def __init__(self, env: Settings, env_file: Path):
        self.env = env
        self.env_file = env_file

    def status(self) -> SecretsStatus:
        return SecretsStatus(
            **{name: bool(getattr(self.env, field)) for name, (_, field) in SECRETS.items()}
        )

    def set(self, name: SecretName, value: str) -> SecretsStatus:
        variable, field = SECRETS[name]
        value = value.strip()
        if name == "email":
            value = value.replace(" ", "")  # Google shows App Passwords in groups of four
        if value and (not VALUE_RE.fullmatch(value) or any(c in value for c in "\"'#\\")):
            raise BadRequestError(
                "That doesn't look like a key. Paste it again without spaces or quotes."
            )
        self._write(variable, value)
        setattr(self.env, field, value)
        return self.status()

    def _write(self, variable: str, value: str) -> None:
        lines = (
            self.env_file.read_text(encoding="utf-8").splitlines() if self.env_file.exists() else []
        )
        line = f"{variable}={value}"
        pattern = re.compile(rf"^\s*{variable}\s*=")
        for index, existing in enumerate(lines):
            if pattern.match(existing):
                lines[index] = line
                break
        else:
            lines.append(line)

        self.env_file.parent.mkdir(parents=True, exist_ok=True)
        temp = self.env_file.with_name(self.env_file.name + ".tmp")
        temp.write_text("\n".join(lines) + "\n", encoding="utf-8")
        os.replace(temp, self.env_file)  # never leaves a half-written .env behind
