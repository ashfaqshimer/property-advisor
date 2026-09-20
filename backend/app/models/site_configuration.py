"""The `site_configurations` table.

Stores system-wide configuration, including the primary contact details for the AI agent to reference.
"""

import uuid
from typing import Any

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

    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    instagram_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    facebook_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    x_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tiktok_link: Mapped[str | None] = mapped_column(String(255), nullable=True)

    city: Mapped[str | None] = mapped_column(String(255), nullable=True)

    extra_settings: Mapped[dict[str, Any] | None] = mapped_column(JSON(), nullable=True, default=dict)

    def __repr__(self) -> str:
        return f"<SiteConfiguration {self.id!s}>"
