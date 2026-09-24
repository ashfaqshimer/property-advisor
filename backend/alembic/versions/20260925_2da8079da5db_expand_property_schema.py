"""expand property schema

Revision ID: 2da8079da5db
Revises: c9d8ac458754
Create Date: 2026-09-25 02:35:11.729194

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2da8079da5db'
down_revision: Union[str, Sequence[str], None] = 'c9d8ac458754'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('properties', sa.Column('source_platform', sa.String(length=64), nullable=True))
    op.add_column('properties', sa.Column('source_url', sa.Text(), nullable=True))
    op.add_column('properties', sa.Column('source_id', sa.String(length=128), nullable=True))
    op.add_column('properties', sa.Column('prospect_id', sa.Uuid(), nullable=True))
    op.add_column('properties', sa.Column('has_maids_room', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('properties', sa.Column('has_maids_toilet', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('properties', sa.Column('is_gated_community', sa.Boolean(), server_default='false', nullable=False))
    op.create_index(op.f('ix_properties_prospect_id'), 'properties', ['prospect_id'], unique=False)
    op.create_index(op.f('ix_properties_source_platform'), 'properties', ['source_platform'], unique=False)
    op.create_foreign_key(op.f('fk_properties_prospect_id_prospects'), 'properties', 'prospects', ['prospect_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f('fk_properties_prospect_id_prospects'), 'properties', type_='foreignkey')
    op.drop_index(op.f('ix_properties_source_platform'), table_name='properties')
    op.drop_index(op.f('ix_properties_prospect_id'), table_name='properties')
    op.drop_column('properties', 'is_gated_community')
    op.drop_column('properties', 'has_maids_toilet')
    op.drop_column('properties', 'has_maids_room')
    op.drop_column('properties', 'prospect_id')
    op.drop_column('properties', 'source_id')
    op.drop_column('properties', 'source_url')
    op.drop_column('properties', 'source_platform')
