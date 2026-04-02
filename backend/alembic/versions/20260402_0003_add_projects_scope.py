"""add project scope to personas and evaluations

Revision ID: 20260402_0003
Revises: 20260319_0002
Create Date: 2026-04-02 00:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260402_0003"
down_revision: Union[str, Sequence[str], None] = "20260319_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_user_id", "name", name="uq_projects_owner_user_id_name"),
    )
    op.create_index(op.f("ix_projects_id"), "projects", ["id"], unique=False)
    op.create_index(op.f("ix_projects_owner_user_id"), "projects", ["owner_user_id"], unique=False)

    op.add_column("personas", sa.Column("project_id", sa.Integer(), nullable=True))
    op.add_column("evaluations", sa.Column("project_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_personas_project_id"), "personas", ["project_id"], unique=False)
    op.create_index(op.f("ix_evaluations_project_id"), "evaluations", ["project_id"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO projects (owner_user_id, name, created_at)
            SELECT owner_user_id, 'General', CURRENT_TIMESTAMP
            FROM (
                SELECT DISTINCT owner_user_id FROM personas
                UNION
                SELECT DISTINCT owner_user_id FROM evaluations
            ) owners
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE personas
            SET project_id = projects.id
            FROM projects
            WHERE personas.project_id IS NULL
              AND personas.owner_user_id = projects.owner_user_id
              AND projects.name = 'General'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE evaluations
            SET project_id = projects.id
            FROM projects
            WHERE evaluations.project_id IS NULL
              AND evaluations.owner_user_id = projects.owner_user_id
              AND projects.name = 'General'
            """
        )
    )

    op.alter_column("personas", "project_id", nullable=False)
    op.alter_column("evaluations", "project_id", nullable=False)
    op.create_foreign_key("fk_personas_project_id_projects", "personas", "projects", ["project_id"], ["id"])
    op.create_foreign_key("fk_evaluations_project_id_projects", "evaluations", "projects", ["project_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_evaluations_project_id_projects", "evaluations", type_="foreignkey")
    op.drop_constraint("fk_personas_project_id_projects", "personas", type_="foreignkey")
    op.drop_index(op.f("ix_evaluations_project_id"), table_name="evaluations")
    op.drop_index(op.f("ix_personas_project_id"), table_name="personas")
    op.drop_column("evaluations", "project_id")
    op.drop_column("personas", "project_id")

    op.drop_index(op.f("ix_projects_owner_user_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_id"), table_name="projects")
    op.drop_table("projects")
