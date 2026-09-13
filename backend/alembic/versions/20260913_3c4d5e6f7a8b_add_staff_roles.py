"""add staff roles

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3c4d5e6f7a8b"
down_revision: Union[str, Sequence[str], None] = "2b3c4d5e6f7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("staff_users", sa.Column("role", sa.String(length=20), nullable=True))
    op.execute("UPDATE staff_users SET role = 'root' WHERE role IS NULL")
    op.alter_column("staff_users", "role", existing_type=sa.String(length=20), nullable=False, server_default="root")


def downgrade() -> None:
    op.drop_column("staff_users", "role")