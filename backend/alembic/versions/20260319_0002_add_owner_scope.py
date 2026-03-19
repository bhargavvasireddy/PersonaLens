"""add owner scope to personas and evaluations

Revision ID: 20260319_0002
Revises: 20260302_0001
Create Date: 2026-03-19 00:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260319_0002"
down_revision: Union[str, Sequence[str], None] = "20260302_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "personas",
        sa.Column("owner_user_id", sa.String(length=255), nullable=False, server_default="legacy-unowned"),
    )
    op.add_column(
        "evaluations",
        sa.Column("owner_user_id", sa.String(length=255), nullable=False, server_default="legacy-unowned"),
    )
    op.create_index(op.f("ix_personas_owner_user_id"), "personas", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_evaluations_owner_user_id"), "evaluations", ["owner_user_id"], unique=False)

    # Existing rows predate owner scoping. Keep them hidden from user-scoped queries.
    op.alter_column("personas", "owner_user_id", server_default=None)
    op.alter_column("evaluations", "owner_user_id", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_evaluations_owner_user_id"), table_name="evaluations")
    op.drop_index(op.f("ix_personas_owner_user_id"), table_name="personas")
    op.drop_column("evaluations", "owner_user_id")
    op.drop_column("personas", "owner_user_id")
