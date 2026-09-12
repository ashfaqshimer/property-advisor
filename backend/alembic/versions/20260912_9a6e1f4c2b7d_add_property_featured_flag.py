"""add property featured flag

Revision ID: 9a6e1f4c2b7d
Revises: 7c1f5b8a2d3e
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9a6e1f4c2b7d"
down_revision: Union[str, Sequence[str], None] = "7c1f5b8a2d3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("is_featured", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_index("ix_properties_is_featured", "properties", ["is_featured"])
    op.alter_column("properties", "is_featured", server_default=sa.false())


def downgrade() -> None:
    op.drop_index("ix_properties_is_featured", table_name="properties")
    op.drop_column("properties", "is_featured")