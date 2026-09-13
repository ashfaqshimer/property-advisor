"""add lead remarks

Revision ID: 5e6f7a8b9c0d
Revises: 4d5e6f7a8b9c
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5e6f7a8b9c0d"
down_revision: Union[str, Sequence[str], None] = "4d5e6f7a8b9c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("remarks", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "remarks")
