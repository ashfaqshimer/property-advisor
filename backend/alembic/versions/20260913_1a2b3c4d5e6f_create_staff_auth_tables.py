"""create staff auth tables

Revision ID: 1a2b3c4d5e6f
Revises: 9a6e1f4c2b7d
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1a2b3c4d5e6f"
down_revision: Union[str, Sequence[str], None] = "9a6e1f4c2b7d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_staff_users")),
        sa.UniqueConstraint("email", name=op.f("uq_staff_users_email")),
    )
    op.create_index(op.f("ix_staff_users_email"), "staff_users", ["email"], unique=True)
    op.create_table(
        "staff_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["staff_users.id"], name=op.f("fk_staff_sessions_user_id_staff_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_staff_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_staff_sessions_token_hash")),
    )
    op.create_index(op.f("ix_staff_sessions_user_id"), "staff_sessions", ["user_id"], unique=False)
    op.create_index(op.f("ix_staff_sessions_token_hash"), "staff_sessions", ["token_hash"], unique=True)
    op.create_index(op.f("ix_staff_sessions_expires_at"), "staff_sessions", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_staff_sessions_expires_at"), table_name="staff_sessions")
    op.drop_index(op.f("ix_staff_sessions_token_hash"), table_name="staff_sessions")
    op.drop_index(op.f("ix_staff_sessions_user_id"), table_name="staff_sessions")
    op.drop_table("staff_sessions")
    op.drop_index(op.f("ix_staff_users_email"), table_name="staff_users")
    op.drop_table("staff_users")