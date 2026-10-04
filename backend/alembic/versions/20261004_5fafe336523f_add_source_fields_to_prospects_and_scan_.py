"""add_source_fields_to_prospects_and_scan_jobs

Revision ID: 5fafe336523f
Revises: a29d1bf96ef3
Create Date: 2026-10-04 22:43:38.641676

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5fafe336523f'
down_revision: Union[str, Sequence[str], None] = 'a29d1bf96ef3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("prospects") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(length=32), server_default="ikman", nullable=False))
        batch_op.add_column(sa.Column("source_id", sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column("source_url", sa.Text(), nullable=True))
        batch_op.alter_column("ikman_ad_id", existing_type=sa.String(length=64), nullable=True)
        batch_op.alter_column("ikman_url", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("ikman_slug", existing_type=sa.String(length=256), nullable=True)
        batch_op.drop_index("ix_prospects_ikman_ad_id")
        batch_op.create_index("ix_prospects_ikman_ad_id", ["ikman_ad_id"], unique=False)
        batch_op.create_index("ix_prospects_source", ["source"], unique=False)
        batch_op.create_index("ix_prospects_source_source_id", ["source", "source_id"], unique=True)

    op.execute(
        "UPDATE prospects SET source = 'ikman', source_id = ikman_ad_id, source_url = ikman_url "
        "WHERE source_id IS NULL AND ikman_ad_id IS NOT NULL"
    )

    with op.batch_alter_table("scan_jobs") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(length=32), server_default="ikman", nullable=False))
        batch_op.create_index("ix_scan_jobs_source", ["source"], unique=False)

    op.execute("UPDATE scan_jobs SET source = 'ikman' WHERE source IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("scan_jobs") as batch_op:
        batch_op.drop_index("ix_scan_jobs_source")
        batch_op.drop_column("source")

    with op.batch_alter_table("prospects") as batch_op:
        batch_op.drop_index("ix_prospects_source_source_id")
        batch_op.drop_index("ix_prospects_source")
        batch_op.drop_index("ix_prospects_ikman_ad_id")
        batch_op.create_index("ix_prospects_ikman_ad_id", ["ikman_ad_id"], unique=True)
        batch_op.alter_column("ikman_slug", existing_type=sa.String(length=256), nullable=False)
        batch_op.alter_column("ikman_url", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("ikman_ad_id", existing_type=sa.String(length=64), nullable=False)
        batch_op.drop_column("source_url")
        batch_op.drop_column("source_id")
        batch_op.drop_column("source")
