"""add staff names and lead editors

Revision ID: 7a8b9c0d1e2f
Revises: 6f7a8b9c0d1e
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7a8b9c0d1e2f"
down_revision: Union[str, Sequence[str], None] = "6f7a8b9c0d1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "staff_users",
        sa.Column("name", sa.String(length=120), server_default="root", nullable=False),
    )
    op.add_column("leads", sa.Column("edited_by_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_leads_edited_by_staff_users"),
        "leads",
        "staff_users",
        ["edited_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_leads_edited_by_id"), "leads", ["edited_by_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_edited_by_id"), table_name="leads")
    op.drop_constraint(op.f("fk_leads_edited_by_staff_users"), "leads", type_="foreignkey")
    op.drop_column("leads", "edited_by_id")
    op.drop_column("staff_users", "name")