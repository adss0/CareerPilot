from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlmodel import SQLModel

import app.models  # noqa: F401
from app.core.db import database_url, make_engine, run_migrations

FIRST_REVISION = "b05b9e72a7ab"


def test_migrations_create_schema_matching_models(tmp_path):
    url = database_url(str(tmp_path / "test.db"))
    run_migrations(url)

    engine = make_engine(url)
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
        diff = compare_metadata(MigrationContext.configure(connection), SQLModel.metadata)
    engine.dispose()

    assert {"application", "profile", "coverletter", "emaillog", "importbatch"} <= tables
    assert {"statushistory", "cvdocument", "alembic_version"} <= tables
    assert diff == [], f"Models changed without a migration: {diff}"


def test_upgrading_keeps_existing_data(tmp_path):
    """Batch migrations rebuild tables; related rows must survive (no cascade deletes)."""
    url = database_url(str(tmp_path / "old.db"))
    run_migrations(url, FIRST_REVISION)

    engine = make_engine(url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO application (id, company, role, job_url, job_description, "
                "contact_name, contact_email, location, salary, source, status, priority, notes, "
                "created_at, updated_at) VALUES (1, 'Acme Ltd', 'Dev', '', '', '', '', '', '', "
                "'manual', 'SENT', 0, '', '2026-01-01', '2026-01-01')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO statushistory (application_id, to_status, changed_at) "
                "VALUES (1, 'SENT', '2026-01-01')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO profile (id, full_name, email, phone, location, linkedin_url, "
                "github_url, portfolio_url, summary, skills, cv_text, cv_file_path, created_at, "
                "updated_at) VALUES (1, 'Jane Example', '', '', '', '', '', '', '', "
                "'[\"Python\"]', '', '', '2026-01-01', '2026-01-01')"
            )
        )
    engine.dispose()

    run_migrations(url)

    engine = make_engine(url)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT company, cv_id FROM application")).all() == [
            ("Acme Ltd", None)
        ]
        assert connection.execute(text("SELECT COUNT(*) FROM statushistory")).scalar() == 1
        profile = connection.execute(
            text("SELECT full_name, skills, experience FROM profile")
        ).one()
        assert profile == ("Jane Example", '["Python"]', "[]")
    engine.dispose()
