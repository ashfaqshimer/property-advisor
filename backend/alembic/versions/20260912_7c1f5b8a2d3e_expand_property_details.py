"""expand property details

Revision ID: 7c1f5b8a2d3e
Revises: c9432564c721
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c1f5b8a2d3e"
down_revision: Union[str, Sequence[str], None] = "c9432564c721"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("listing_type", sa.String(length=4), nullable=True),
    )
    op.execute("UPDATE properties SET listing_type = 'sale'")
    op.alter_column("properties", "listing_type", nullable=False)
    op.create_check_constraint(
        "ck_properties_listing_type",
        "properties",
        "listing_type IN ('sale', 'rent')",
    )
    op.create_index("ix_properties_listing_type", "properties", ["listing_type"])

    op.add_column(
        "properties",
        sa.Column("is_price_per_perch", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.alter_column("properties", "sqft", new_column_name="floor_area_sqft")
    op.add_column("properties", sa.Column("land_size_perches", sa.Numeric(8, 2), nullable=True))
    op.add_column("properties", sa.Column("parking_spaces", sa.Integer(), nullable=True))
    op.add_column("properties", sa.Column("build_year", sa.Integer(), nullable=True))
    op.add_column("properties", sa.Column("road_access_ft", sa.Integer(), nullable=True))
    op.add_column(
        "properties",
        sa.Column("furnishing_status", sa.String(length=13), nullable=True),
    )
    op.create_check_constraint(
        "ck_properties_furnishing_status",
        "properties",
        "furnishing_status IN ('unfurnished', 'semi_furnished', 'fully_furnished')",
    )
    op.add_column("properties", sa.Column("amenities", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("properties", "amenities")
    op.drop_constraint("ck_properties_furnishing_status", "properties", type_="check")
    op.drop_column("properties", "furnishing_status")
    op.drop_column("properties", "road_access_ft")
    op.drop_column("properties", "build_year")
    op.drop_column("properties", "parking_spaces")
    op.drop_column("properties", "land_size_perches")
    op.alter_column("properties", "floor_area_sqft", new_column_name="sqft")
    op.drop_column("properties", "is_price_per_perch")
    op.drop_index("ix_properties_listing_type", table_name="properties")
    op.drop_constraint("ck_properties_listing_type", "properties", type_="check")
    op.drop_column("properties", "listing_type")