"""expand_scan_job_property_category_to_text

Revision ID: f88af9ed7586
Revises: 5fafe336523f
Create Date: 2026-10-05 12:52:48.060508

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f88af9ed7586'
down_revision: Union[str, Sequence[str], None] = '5fafe336523f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("scan_jobs") as batch_op:
        batch_op.alter_column(
            "property_category",
            existing_type=sa.String(length=64),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("scan_jobs") as batch_op:
        batch_op.alter_column(
            "property_category",
            existing_type=sa.Text(),
            type_=sa.String(length=64),
            existing_nullable=True,
        )
