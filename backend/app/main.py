from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    applications,
    backup,
    cvs,
    emails,
    health,
    imports,
    letters,
    profile,
    stats,
    tracking,
)
from app.api import settings as settings_api
from app.api.deps import get_email_queue, get_reply_checker
from app.core.config import get_settings
from app.core.db import run_migrations
from app.core.errors import BadRequestError, NotFoundError
from app.core.security import LocalSecurityMiddleware
from app.integrations.ai import AIError, AIRateLimitError
from app.services.spreadsheet_reader import SpreadsheetError


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    get_settings().db_file.parent.mkdir(parents=True, exist_ok=True)  # first run: no folder yet
    backup.get_backup_service().apply_pending()  # a restore staged before the restart
    run_migrations()  # also upgrades a backup made by an older version
    email_queue = get_email_queue()
    email_queue.start()  # sends approved emails in the background
    reply_checker = get_reply_checker()
    reply_checker.start()  # looks for replies in your inbox every 30 minutes
    yield
    email_queue.stop()
    reply_checker.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

    # Added first, so it runs after CORS: pre-flight requests are answered before the checks.
    app.add_middleware(LocalSecurityMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CareerPilot"],
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(BadRequestError)
    @app.exception_handler(SpreadsheetError)
    async def bad_request_handler(_request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(AIError)
    async def ai_error_handler(_request: Request, exc: AIError) -> JSONResponse:
        # 429 when a free-tier limit was hit (worth retrying later), 503 for other AI problems.
        code = 429 if isinstance(exc, AIRateLimitError) else 503
        return JSONResponse(status_code=code, content={"detail": str(exc)})

    app.include_router(health.router, prefix="/api")
    app.include_router(applications.router, prefix="/api")
    app.include_router(imports.router, prefix="/api")
    app.include_router(cvs.router, prefix="/api")
    app.include_router(profile.router, prefix="/api")
    app.include_router(letters.router, prefix="/api")
    app.include_router(stats.router, prefix="/api")
    app.include_router(emails.router, prefix="/api")
    app.include_router(tracking.router, prefix="/api")
    app.include_router(backup.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api")
    return app


app = create_app()
