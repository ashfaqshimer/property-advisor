"""fix furnishing_status length

Revision ID: c9d8ac458754
Revises: 38807aff87a5
Create Date: 2026-09-25 02:06:54.684540

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d8ac458754'
down_revision: Union[str, Sequence[str], None] = '38807aff87a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('properties', 'furnishing_status',
               type_=sa.VARCHAR(length=16),
               existing_nullable=True)
    op.alter_column('properties', 'listing_type',
               type_=sa.VARCHAR(length=16),
               existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('properties', 'furnishing_status',
               type_=sa.VARCHAR(length=13),
               existing_nullable=True)
    op.alter_column('properties', 'listing_type',
               type_=sa.VARCHAR(length=4),
               existing_nullable=False)
