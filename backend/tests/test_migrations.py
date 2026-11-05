from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect
from sqlmodel import SQLModel

import app.models  # noqa: F401
from app.core.db import database_url, make_engine, run_migrations


def test_migrations_create_schema_matching_models(tmp_path):
    url = database_url(str(tmp_path / "test.db"))
    run_migrations(url)

    engine = make_engine(url)
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
        diff = compare_metadata(MigrationContext.configure(connection), SQLModel.metadata)
    engine.dispose()

    assert {"application", "profile", "coverletter", "emaillog", "importbatch"} <= tables
    assert {"statushistory", "alembic_version"} <= tables
    assert diff == [], f"Models changed without a migration: {diff}"
