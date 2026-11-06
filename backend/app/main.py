from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import applications, health, imports, profile
from app.core.config import get_settings
from app.core.db import run_migrations
from app.core.errors import BadRequestError, NotFoundError
from app.services.spreadsheet_reader import SpreadsheetError


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(BadRequestError)
    @app.exception_handler(SpreadsheetError)
    async def bad_request_handler(_request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    app.include_router(health.router, prefix="/api")
    app.include_router(applications.router, prefix="/api")
    app.include_router(imports.router, prefix="/api")
    app.include_router(profile.router, prefix="/api")
    return app


app = create_app()
