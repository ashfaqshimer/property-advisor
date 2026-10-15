"""add_property_code

Revision ID: 8a1b2c3d4e5f
Revises: 7f9b2d8e1a3c
Create Date: 2026-10-15 15:15:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "7f9b2d8e1a3c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("properties") as batch_op:
        batch_op.add_column(sa.Column("property_code", sa.String(length=20), nullable=True))

    bind = op.get_bind()
    is_offline = context.is_offline_mode()

    if not is_offline and bind is not None and getattr(bind, "engine", None) and bind.engine.name == "postgresql":
        op.execute(
            """
            WITH numbered AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) + 1000 AS rn
                FROM properties
            )
            UPDATE properties
            SET property_code = 'PA-' || numbered.rn
            FROM numbered
            WHERE properties.id = numbered.id;
            """
        )
    elif not is_offline and bind is not None:
        try:
            properties_table = sa.table(
                "properties",
                sa.column("id", sa.Uuid),
                sa.column("property_code", sa.String),
                sa.column("created_at", sa.DateTime),
            )
            res = bind.execute(
                sa.select(properties_table.c.id).order_by(properties_table.c.created_at.asc())
            )
            if res:
                rows = res.fetchall()
                for idx, row in enumerate(rows, start=1001):
                    code = f"PA-{idx}"
                    bind.execute(
                        properties_table.update()
                        .where(properties_table.c.id == row.id)
                        .values(property_code=code)
                    )
        except Exception:
            pass

    with op.batch_alter_table("properties") as batch_op:
        batch_op.alter_column("property_code", nullable=False)
        batch_op.create_index("ix_properties_property_code", ["property_code"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("properties") as batch_op:
        batch_op.drop_index("ix_properties_property_code")
        batch_op.drop_column("property_code")
