"""allow nullable price and add mixed_use property type

Revision ID: 20261005_mixed_use_and_nullable_price
Revises: e4729817e45b
Create Date: 2026-10-05 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261005_mixed_use_price'
down_revision: Union[str, Sequence[str], None] = 'e4729817e45b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter price to nullable
    op.alter_column(
        'properties',
        'price',
        existing_type=sa.Numeric(precision=14, scale=2),
        nullable=True,
    )

    # 2. Update CHECK constraint for property_type to allow 'mixed_use'
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE properties DROP CONSTRAINT IF EXISTS ck_properties_property_type")
        op.execute("ALTER TABLE properties DROP CONSTRAINT IF EXISTS property_type")
        op.execute(
            "ALTER TABLE properties ADD CONSTRAINT ck_properties_property_type "
            "CHECK (property_type IN ('house', 'apartment', 'land', 'commercial', 'mixed_use'))"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE properties DROP CONSTRAINT IF EXISTS ck_properties_property_type")
        op.execute(
            "ALTER TABLE properties ADD CONSTRAINT ck_properties_property_type "
            "CHECK (property_type IN ('house', 'apartment', 'land', 'commercial'))"
        )

    op.alter_column(
        'properties',
        'price',
        existing_type=sa.Numeric(precision=14, scale=2),
        nullable=False,
    )
