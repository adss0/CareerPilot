import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Where the code and its bundled files (alembic.ini, migrations) live. In the desktop app the
# backend is a PyInstaller bundle that unpacks to sys._MEIPASS.
BACKEND_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))

# Where the user's data lives: the desktop app sets CAREERPILOT_HOME to the Windows app-data
# folder; in development it's backend/.
HOME_DIR = (
    Path(os.environ["CAREERPILOT_HOME"]) if os.environ.get("CAREERPILOT_HOME") else BACKEND_DIR
)
if not os.environ.get("CAREERPILOT_HOME") and getattr(sys, "frozen", False):
    HOME_DIR = Path(sys.executable).parent  # a bundle run by hand: keep data next to it


class Settings(BaseSettings):
    # The .env file and relative paths are inside the home folder, wherever the server starts.
    model_config = SettingsConfigDict(
        env_file=HOME_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "CareerPilot"
    version: str = "1.6.0"

    ai_provider: Literal["gemini", "groq", "ollama"] = "gemini"
    gemini_api_key: str = ""
    # Google retires and renames models; if this one is busy or gone, the fallbacks are used.
    gemini_model: str = "gemini-3-flash-preview"
    # Used when the main model is busy, too slow or retired (comma separated).
    gemini_fallback_models: str = "gemini-flash-lite-latest,gemini-3.1-flash-lite"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    ai_timeout_seconds: float = 60
    # Pause between AI calls in bulk generation, to stay inside free-tier rate limits.
    ai_request_gap_seconds: float = 4

    # Job boards for "Find jobs" (free keys): https://www.reed.co.uk/developers and
    # https://developer.adzuna.com
    reed_api_key: str = ""
    # Only changed by the end-to-end test, which points it at a fake Reed.
    reed_api_base: str = "https://www.reed.co.uk/api/1.0"
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    jooble_api_key: str = ""  # https://jooble.org/api/about
    jooble_api_base: str = "https://jooble.org/api"

    # Email (SMTP/IMAP) password, e.g. a Gmail App Password. Never stored in the database.
    email_password: str = ""
    # How often the send queue checks for emails to send (seconds).
    email_queue_interval_seconds: float = 15
    # How often to check the inbox for replies (minutes).
    reply_check_minutes: float = 30

    db_path: str = "careerpilot.db"
    # Uploaded CVs and other private files. Git-ignored.
    data_dir: str = "data"
    cors_origins: str = "http://localhost:5173"

    @property
    def db_file(self) -> Path:
        return self._resolve(self.db_path)

    @property
    def cv_dir(self) -> Path:
        return self._resolve(self.data_dir) / "cvs"

    @staticmethod
    def _resolve(value: str) -> Path:
        path = Path(value)
        return path if path.is_absolute() else HOME_DIR / path

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
