"""add_prospects_performance_indexes

Revision ID: 7f9b2d8e1a3c
Revises: 4b8f1c8e9a2d
Create Date: 2026-10-06 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f9b2d8e1a3c'
down_revision: Union[str, Sequence[str], None] = '4b8f1c8e9a2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("prospects") as batch_op:
        batch_op.create_index("ix_prospects_status", ["status"], unique=False)
        batch_op.create_index("ix_prospects_first_seen_at", ["first_seen_at"], unique=False)
        batch_op.create_index(
            "ix_prospects_status_first_seen_at",
            ["status", "first_seen_at"],
            unique=False,
        )
        batch_op.create_index("ix_prospects_property_type", ["property_type"], unique=False)
        batch_op.create_index("ix_prospects_listing_type", ["listing_type"], unique=False)
        batch_op.create_index("ix_prospects_suburb", ["suburb"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("prospects") as batch_op:
        batch_op.drop_index("ix_prospects_suburb")
        batch_op.drop_index("ix_prospects_listing_type")
        batch_op.drop_index("ix_prospects_property_type")
        batch_op.drop_index("ix_prospects_status_first_seen_at")
        batch_op.drop_index("ix_prospects_first_seen_at")
        batch_op.drop_index("ix_prospects_status")
