"""add_scan_job_metrics_and_prospect_provenance

Revision ID: 0ef114dcffcd
Revises: edee664c6d68
Create Date: 2026-10-03 04:37:35.938825

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0ef114dcffcd'
down_revision: Union[str, Sequence[str], None] = 'edee664c6d68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('prospects', sa.Column('first_scan_job_id', sa.Uuid(), nullable=True))
    op.add_column('prospects', sa.Column('discard_reason', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_prospects_first_scan_job_id'), 'prospects', ['first_scan_job_id'], unique=False)
    op.create_foreign_key(op.f('fk_prospects_first_scan_job_id_scan_jobs'), 'prospects', 'scan_jobs', ['first_scan_job_id'], ['id'])
    
    op.add_column('scan_jobs', sa.Column('keyword', sa.String(length=128), nullable=True))
    op.add_column('scan_jobs', sa.Column('property_category', sa.String(length=64), nullable=True))
    op.add_column('scan_jobs', sa.Column('pages_scanned', sa.Integer(), server_default='0', nullable=False))
    op.add_column('scan_jobs', sa.Column('total_pages', sa.Integer(), server_default='0', nullable=False))
    op.add_column('scan_jobs', sa.Column('total_found', sa.Integer(), server_default='0', nullable=False))
    op.add_column('scan_jobs', sa.Column('new_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('scan_jobs', sa.Column('updated_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('scan_jobs', sa.Column('filtered_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('scan_jobs', sa.Column('duration_seconds', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('scan_jobs', 'duration_seconds')
    op.drop_column('scan_jobs', 'filtered_count')
    op.drop_column('scan_jobs', 'updated_count')
    op.drop_column('scan_jobs', 'new_count')
    op.drop_column('scan_jobs', 'total_found')
    op.drop_column('scan_jobs', 'total_pages')
    op.drop_column('scan_jobs', 'pages_scanned')
    op.drop_column('scan_jobs', 'property_category')
    op.drop_column('scan_jobs', 'keyword')
    op.drop_constraint(op.f('fk_prospects_first_scan_job_id_scan_jobs'), 'prospects', type_='foreignkey')
    op.drop_index(op.f('ix_prospects_first_scan_job_id'), table_name='prospects')
    op.drop_column('prospects', 'discard_reason')
    op.drop_column('prospects', 'first_scan_job_id')
