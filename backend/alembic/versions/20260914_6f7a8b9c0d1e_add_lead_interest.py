"""add structured lead interest and rename preferences

Revision ID: 6f7a8b9c0d1e
Revises: 5e6f7a8b9c0d
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f7a8b9c0d1e"
down_revision: Union[str, Sequence[str], None] = "5e6f7a8b9c0d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


lead_interest = sa.Enum(
    "apartment_sale",
    "apartment_rent",
    "house_sale",
    "house_rent",
    "land",
    "selling",
    "other",
    name="lead_interest",
    native_enum=False,
    create_constraint=True,
    length=16,
)


def upgrade() -> None:
    op.alter_column("leads", "preferences", new_column_name="requirements")
    op.add_column("leads", sa.Column("interest", lead_interest, nullable=True))
    op.create_index(op.f("ix_leads_interest"), "leads", ["interest"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_interest"), table_name="leads")
    op.drop_column("leads", "interest")
    op.alter_column("leads", "requirements", new_column_name="preferences")
