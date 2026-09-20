"""The `site_configurations` table.

Stores system-wide configuration, including the primary contact details for the AI agent to reference.
"""

import uuid
from typing import Any

import sqlalchemy as sa
from sqlalchemy import String, Text, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class SiteConfiguration(Base):
    __tablename__ = "site_configurations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # A Postgres array, per spec — the honest type for a list of scalars.
    # The sqlite variant exists purely so the test suite can build this table without a Postgres.
    phone_numbers: Mapped[list[str]] = mapped_column(
        ARRAY(Text).with_variant(JSON(), "sqlite"), nullable=False, default=list
    )
    show_phone_numbers: Mapped[bool] = mapped_column(default=True, server_default=sa.text("true"))

    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_contact_email: Mapped[bool] = mapped_column(default=True, server_default=sa.text("true"))

    instagram_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_instagram_link: Mapped[bool] = mapped_column(default=True, server_default=sa.text("true"))

    facebook_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_facebook_link: Mapped[bool] = mapped_column(default=True, server_default=sa.text("true"))

    x_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_x_link: Mapped[bool] = mapped_column(default=True, server_default=sa.text("true"))

    tiktok_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_tiktok_link: Mapped[bool] = mapped_column(default=True, server_default=sa.text("true"))

    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_city: Mapped[bool] = mapped_column(default=True, server_default=sa.text("true"))

    extra_settings: Mapped[dict[str, Any] | None] = mapped_column(JSON(), nullable=True, default=dict)

    def __repr__(self) -> str:
        return f"<SiteConfiguration {self.id!s}>"
