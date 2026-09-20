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

    phone_numbers: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"values\": [], \"show\": true}'"))
    contact_email: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"value\": null, \"show\": true}'"))
    whatsapp: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"value\": null, \"show\": true}'"))
    instagram_link: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"value\": null, \"show\": true}'"))
    facebook_link: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"value\": null, \"show\": true}'"))
    x_link: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"value\": null, \"show\": true}'"))
    tiktok_link: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"value\": null, \"show\": true}'"))
    city: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False, server_default=sa.text("'{\"value\": null, \"show\": true}'"))

    extra_settings: Mapped[dict[str, Any] | None] = mapped_column(JSON(), nullable=True, default=dict)
    prospect_retention_days: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("30"))

    def __repr__(self) -> str:
        return f"<SiteConfiguration {self.id!s}>"
