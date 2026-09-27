"""Add pg_trgm indexes on prospects for fuzzy search

Revision ID: a3f9d1b82c44
Revises: 618d8e137a9a
Create Date: 2026-09-27 23:12:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3f9d1b82c44'
down_revision: Union[str, Sequence[str], None] = '5f56afc125ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_prospects_location_trgm "
        "ON prospects USING GIN (location gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_prospects_title_trgm "
        "ON prospects USING GIN (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_prospects_poster_name_trgm "
        "ON prospects USING GIN (poster_name gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_prospects_poster_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_prospects_title_trgm")
    op.execute("DROP INDEX IF EXISTS ix_prospects_location_trgm")
