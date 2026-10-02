"""add_suburb_to_prospects

Revision ID: edee664c6d68
Revises: a3f9d1b82c44
Create Date: 2026-09-30 20:19:36.887275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'edee664c6d68'
down_revision: Union[str, Sequence[str], None] = 'a3f9d1b82c44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('prospects', sa.Column('suburb', sa.String(length=128), nullable=True))
    op.add_column('prospects', sa.Column('suburb_source', sa.String(length=32), nullable=True))

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_prospects_suburb_trgm "
            "ON prospects USING GIN (suburb gin_trgm_ops)"
        )

    # Backfill existing prospects with extracted suburbs
    try:
        from app.scraper.location_extractor import extract_suburb
        prospects_table = sa.table(
            'prospects',
            sa.column('id', sa.Uuid),
            sa.column('title', sa.Text),
            sa.column('ikman_slug', sa.String),
            sa.column('location', sa.String),
            sa.column('suburb', sa.String),
            sa.column('suburb_source', sa.String),
        )
        conn = op.get_bind()
        results = conn.execute(
            sa.select(
                prospects_table.c.id,
                prospects_table.c.title,
                prospects_table.c.ikman_slug,
                prospects_table.c.location
            )
        ).fetchall()
        for row in results:
            sub = extract_suburb(title=row.title, slug=row.ikman_slug, district=row.location)
            if sub:
                conn.execute(
                    prospects_table.update()
                    .where(prospects_table.c.id == row.id)
                    .values(suburb=sub, suburb_source='extracted')
                )
    except Exception:
        # Migration shouldn't fail if backfill encounters an unexpected value
        pass


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_prospects_suburb_trgm")
    op.drop_column('prospects', 'suburb_source')
    op.drop_column('prospects', 'suburb')
