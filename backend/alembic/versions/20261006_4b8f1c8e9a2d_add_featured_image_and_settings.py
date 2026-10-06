"""add_featured_image_and_settings

Revision ID: 4b8f1c8e9a2d
Revises: 26d65ddc99d3
Create Date: 2026-10-06 18:11:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b8f1c8e9a2d'
down_revision: Union[str, Sequence[str], None] = '26d65ddc99d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('properties', sa.Column('featured_image_url', sa.Text(), nullable=True))
    op.add_column(
        'site_configurations',
        sa.Column(
            'featured_settings',
            sa.JSON(),
            server_default=sa.text('\'{"visible_count": 4, "cycle_interval_seconds": 6, "auto_cycle": true}\''),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('site_configurations', 'featured_settings')
    op.drop_column('properties', 'featured_image_url')
