from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Paths are relative to backend/, whichever folder the server is started from.
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "CareerPilot"
    version: str = "0.1.0"

    ai_provider: Literal["gemini", "groq", "ollama"] = "gemini"
    gemini_api_key: str = ""
    # "gemini-flash-latest" always points at Google's newest Flash model.
    gemini_model: str = "gemini-flash-latest"
    groq_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ai_timeout_seconds: float = 60

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
        return path if path.is_absolute() else BACKEND_DIR / path

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
