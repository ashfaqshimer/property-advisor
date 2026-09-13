"""add property geolocation

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2b3c4d5e6f7a"
down_revision: Union[str, Sequence[str], None] = "1a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.add_column("properties", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("properties", sa.Column("longitude", sa.Float(), nullable=True))
    op.execute(
        """
        CREATE INDEX ix_properties_location_geography
        ON properties
        USING GIST (
            (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
        )
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_properties_location_geography")
    op.drop_column("properties", "longitude")
    op.drop_column("properties", "latitude")
    # PostGIS may be shared by other application tables, so this migration does not
    # remove the extension during downgrade.