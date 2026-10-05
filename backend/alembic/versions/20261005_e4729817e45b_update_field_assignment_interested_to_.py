"""update_field_assignment_interested_to_contacted

Revision ID: e4729817e45b
Revises: 3c137de9073f
Create Date: 2026-10-05 19:56:34.960623

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4729817e45b'
down_revision: Union[str, Sequence[str], None] = '3c137de9073f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: update existing 'interested' field assignments to 'contacted'."""
    op.execute("UPDATE field_assignments SET status = 'contacted' WHERE status = 'interested'")


def downgrade() -> None:
    """Downgrade schema: revert 'contacted' field assignments back to 'interested'."""
    op.execute("UPDATE field_assignments SET status = 'interested' WHERE status = 'contacted'")
