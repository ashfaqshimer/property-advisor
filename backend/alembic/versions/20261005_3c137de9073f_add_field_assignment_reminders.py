"""add_field_assignment_reminders

Revision ID: 3c137de9073f
Revises: eb11336ec2ad
Create Date: 2026-10-05 19:31:49.782710

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c137de9073f'
down_revision: Union[str, Sequence[str], None] = 'eb11336ec2ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("field_assignments", sa.Column("remind_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_field_assignments_remind_at"), "field_assignments", ["remind_at"], unique=False)
    op.add_column("field_assignments", sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("field_assignments", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("field_assignments", "attempt_count")
    op.drop_column("field_assignments", "reminder_sent_at")
    op.drop_index(op.f("ix_field_assignments_remind_at"), table_name="field_assignments")
    op.drop_column("field_assignments", "remind_at")
