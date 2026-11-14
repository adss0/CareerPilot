"""sponsorship, main cover letter, cv style

Revision ID: a17c0de5b1f7
Revises: 8101912eacd1
Create Date: 2026-11-14 03:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "a17c0de5b1f7"
down_revision: str | None = "8101912eacd1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("application") as batch:
        batch.add_column(
            sa.Column("sponsorship", sa.String(length=10), server_default="unsure", nullable=False)
        )
    with op.batch_alter_table("profile") as batch:
        batch.add_column(
            sa.Column(
                "main_cover_letter",
                sqlmodel.sql.sqltypes.AutoString(),
                server_default="",
                nullable=False,
            )
        )
    with op.batch_alter_table("tailoredcv") as batch:
        batch.add_column(
            sa.Column("style", sa.String(length=20), server_default="", nullable=False)
        )
        batch.add_column(sa.Column("source_cv_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tailoredcv") as batch:
        batch.drop_column("source_cv_id")
        batch.drop_column("style")
    with op.batch_alter_table("profile") as batch:
        batch.drop_column("main_cover_letter")
    with op.batch_alter_table("application") as batch:
        batch.drop_column("sponsorship")
