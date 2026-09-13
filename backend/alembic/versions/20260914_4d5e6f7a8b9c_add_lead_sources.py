"""add lead sources and allow standalone manual leads

Revision ID: 4d5e6f7a8b9c
Revises: 3c4d5e6f7a8b
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4d5e6f7a8b9c"
down_revision: Union[str, Sequence[str], None] = "3c4d5e6f7a8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column(
            "source",
            sa.Enum(
                "ai_agent",
                "manual",
                "fallback",
                name="lead_source",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
    )
    op.create_index(op.f("ix_leads_source"), "leads", ["source"], unique=False)
    op.alter_column("leads", "conversation_id", nullable=True)


def downgrade() -> None:
    op.alter_column("leads", "conversation_id", nullable=False)
    op.drop_index(op.f("ix_leads_source"), table_name="leads")
    op.drop_column("leads", "source")
