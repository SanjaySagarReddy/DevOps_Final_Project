"""Create incidents table.

Revision ID: 001_create_incidents
Revises:
"""

from alembic import op
import sqlalchemy as sa


revision = "001_create_incidents"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("service", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column("owner", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "severity IN ('critical', 'high', 'medium', 'low')",
            name="ck_incidents_severity",
        ),
        sa.CheckConstraint(
            "status IN ('open', 'investigating', 'mitigated', 'resolved')",
            name="ck_incidents_status",
        ),
    )
    op.create_index("ix_incidents_service", "incidents", ["service"])
    op.create_index("ix_incidents_status_updated_at", "incidents", ["status", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_incidents_status_updated_at", table_name="incidents")
    op.drop_index("ix_incidents_service", table_name="incidents")
    op.drop_table("incidents")
