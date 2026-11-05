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
    groq_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

    db_path: str = "careerpilot.db"
    cors_origins: str = "http://localhost:5173"

    @property
    def db_file(self) -> Path:
        path = Path(self.db_path)
        return path if path.is_absolute() else BACKEND_DIR / path

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
