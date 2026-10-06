"""add_market_benchmarks_and_sync_settings

Revision ID: 26d65ddc99d3
Revises: 20261005_mixed_use_price
Create Date: 2026-10-06 16:23:14.605734

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '26d65ddc99d3'
down_revision: Union[str, Sequence[str], None] = '20261005_mixed_use_price'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('market_benchmarks',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('location', sa.String(length=120), nullable=False),
    sa.Column('property_type', sa.String(length=32), nullable=False),
    sa.Column('listing_type', sa.String(length=16), nullable=False),
    sa.Column('rate_per_sqft', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('rate_per_perch', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('status', sa.String(length=32), server_default='active', nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_market_benchmarks')),
    sa.UniqueConstraint('location', 'property_type', 'listing_type', name='uq_market_benchmarks_loc_type')
    )
    op.create_index(op.f('ix_market_benchmarks_location'), 'market_benchmarks', ['location'], unique=False)
    op.add_column('site_configurations', sa.Column('benchmark_sync_settings', sa.JSON(), server_default=sa.text('\'{"enabled": true, "frequency_days": 7, "last_run_at": null, "last_run_status": null, "next_run_at": null, "custom_locations": []}\''), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('site_configurations', 'benchmark_sync_settings')
    op.drop_index(op.f('ix_market_benchmarks_location'), table_name='market_benchmarks')
    op.drop_table('market_benchmarks')
