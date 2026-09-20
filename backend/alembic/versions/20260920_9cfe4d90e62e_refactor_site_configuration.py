"""refactor site configuration

Revision ID: 9cfe4d90e62e
Revises: 4ebe8366a842
Create Date: 2026-09-20 20:43:11.487127

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9cfe4d90e62e'
down_revision: Union[str, Sequence[str], None] = '4ebe8366a842'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('site_configurations') as batch_op:
        # Drop old flat columns
        batch_op.drop_column('phone_numbers')
        batch_op.drop_column('contact_email')
        batch_op.drop_column('instagram_link')
        batch_op.drop_column('facebook_link')
        batch_op.drop_column('x_link')
        batch_op.drop_column('tiktok_link')
        batch_op.drop_column('city')
        batch_op.drop_column('show_phone_numbers')
        batch_op.drop_column('show_contact_email')
        batch_op.drop_column('show_instagram_link')
        batch_op.drop_column('show_facebook_link')
        batch_op.drop_column('show_x_link')
        batch_op.drop_column('show_tiktok_link')
        batch_op.drop_column('show_city')
        
        # Add new JSON columns
        batch_op.add_column(sa.Column('phone_numbers', sa.JSON(), server_default=sa.text('\'{"values": [], "show": true}\''), nullable=False))
        batch_op.add_column(sa.Column('contact_email', sa.JSON(), server_default=sa.text('\'{"value": null, "show": true}\''), nullable=False))
        batch_op.add_column(sa.Column('whatsapp', sa.JSON(), server_default=sa.text('\'{"value": null, "show": true}\''), nullable=False))
        batch_op.add_column(sa.Column('instagram_link', sa.JSON(), server_default=sa.text('\'{"value": null, "show": true}\''), nullable=False))
        batch_op.add_column(sa.Column('facebook_link', sa.JSON(), server_default=sa.text('\'{"value": null, "show": true}\''), nullable=False))
        batch_op.add_column(sa.Column('x_link', sa.JSON(), server_default=sa.text('\'{"value": null, "show": true}\''), nullable=False))
        batch_op.add_column(sa.Column('tiktok_link', sa.JSON(), server_default=sa.text('\'{"value": null, "show": true}\''), nullable=False))
        batch_op.add_column(sa.Column('city', sa.JSON(), server_default=sa.text('\'{"value": null, "show": true}\''), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('site_configurations') as batch_op:
        batch_op.drop_column('phone_numbers')
        batch_op.drop_column('contact_email')
        batch_op.drop_column('whatsapp')
        batch_op.drop_column('instagram_link')
        batch_op.drop_column('facebook_link')
        batch_op.drop_column('x_link')
        batch_op.drop_column('tiktok_link')
        batch_op.drop_column('city')
        
        batch_op.add_column(sa.Column('phone_numbers', postgresql.ARRAY(sa.TEXT()).with_variant(sa.JSON(), 'sqlite'), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('contact_email', sa.VARCHAR(length=255), nullable=True))
        batch_op.add_column(sa.Column('instagram_link', sa.VARCHAR(length=255), nullable=True))
        batch_op.add_column(sa.Column('facebook_link', sa.VARCHAR(length=255), nullable=True))
        batch_op.add_column(sa.Column('x_link', sa.VARCHAR(length=255), nullable=True))
        batch_op.add_column(sa.Column('tiktok_link', sa.VARCHAR(length=255), nullable=True))
        batch_op.add_column(sa.Column('city', sa.VARCHAR(length=255), nullable=True))
        
        batch_op.add_column(sa.Column('show_phone_numbers', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('show_contact_email', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('show_instagram_link', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('show_facebook_link', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('show_x_link', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('show_tiktok_link', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('show_city', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
