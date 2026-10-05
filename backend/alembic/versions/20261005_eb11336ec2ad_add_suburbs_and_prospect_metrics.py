"""add_suburbs_and_prospect_metrics

Revision ID: eb11336ec2ad
Revises: f88af9ed7586
Create Date: 2026-10-05 14:33:43.226865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'eb11336ec2ad'
down_revision: Union[str, Sequence[str], None] = 'f88af9ed7586'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'suburbs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('slug', sa.String(length=128), nullable=False),
        sa.Column('district', sa.String(length=64), nullable=False),
        sa.Column('ds_division', sa.String(length=128), nullable=True),
        sa.Column('tier', sa.String(length=64), nullable=False),
        sa.Column('aliases', postgresql.ARRAY(sa.Text()).with_variant(sa.JSON(), 'sqlite'), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('baseline_land_perch_min', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('baseline_land_perch_max', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('baseline_apartment_sqft_min', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('baseline_apartment_sqft_max', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_suburbs'))
    )
    op.create_index(op.f('ix_suburbs_district'), 'suburbs', ['district'], unique=False)
    op.create_index(op.f('ix_suburbs_name'), 'suburbs', ['name'], unique=True)
    op.create_index(op.f('ix_suburbs_slug'), 'suburbs', ['slug'], unique=True)

    with op.batch_alter_table("prospects") as batch_op:
        batch_op.add_column(sa.Column('price_numeric', sa.Numeric(precision=14, scale=2), nullable=True))
        batch_op.add_column(sa.Column('is_price_per_perch', sa.Boolean(), server_default='false', nullable=False))
        batch_op.add_column(sa.Column('land_size_perches', sa.Numeric(precision=8, scale=2), nullable=True))
        batch_op.add_column(sa.Column('floor_area_sqft', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('bedrooms', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('bathrooms', sa.Integer(), nullable=True))
        batch_op.create_index(op.f('ix_prospects_price_numeric'), ['price_numeric'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("prospects") as batch_op:
        batch_op.drop_index(op.f('ix_prospects_price_numeric'))
        batch_op.drop_column('bathrooms')
        batch_op.drop_column('bedrooms')
        batch_op.drop_column('floor_area_sqft')
        batch_op.drop_column('land_size_perches')
        batch_op.drop_column('is_price_per_perch')
        batch_op.drop_column('price_numeric')

    op.drop_index(op.f('ix_suburbs_slug'), table_name='suburbs')
    op.drop_index(op.f('ix_suburbs_name'), table_name='suburbs')
    op.drop_index(op.f('ix_suburbs_district'), table_name='suburbs')
    op.drop_table('suburbs')
