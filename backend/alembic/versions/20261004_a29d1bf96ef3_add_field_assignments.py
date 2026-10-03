"""add_field_assignments

Revision ID: a29d1bf96ef3
Revises: 0ef114dcffcd
Create Date: 2026-10-04 02:00:38.884613

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a29d1bf96ef3'
down_revision: Union[str, Sequence[str], None] = '0ef114dcffcd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "field_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prospect_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_by_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("telegram_message_id", sa.BigInteger(), nullable=True),
        sa.Column("awaiting_notes", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["staff_users.id"], name=op.f("fk_field_assignments_assigned_by_id_staff_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["prospect_id"], ["prospects.id"], name=op.f("fk_field_assignments_prospect_id_prospects"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_field_assignments")),
    )
    op.create_index(op.f("ix_field_assignments_prospect_id"), "field_assignments", ["prospect_id"], unique=False)
    op.create_index(op.f("ix_field_assignments_status"), "field_assignments", ["status"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_field_assignments_status"), table_name="field_assignments")
    op.drop_index(op.f("ix_field_assignments_prospect_id"), table_name="field_assignments")
    op.drop_table("field_assignments")
