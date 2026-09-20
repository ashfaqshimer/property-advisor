"""The `property_contacts` and `property_contact_phones` tables.

`property_contacts` stores external owners and brokers attached to a listing.
These are not staff users — they are the people who own or manage the property.

`property_contact_phones` is a child table: one contact row, many phone entries.
Any phone number can be flagged as WhatsApp-reachable via `is_whatsapp`.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models._enum import enum_column

if TYPE_CHECKING:
    from app.models.property import Property


class PropertyContactType(str, enum.Enum):
    OWNER = "owner"
    BROKER = "broker"


class PropertyContact(Base):
    __tablename__ = "property_contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contact_type: Mapped[PropertyContactType] = mapped_column(
        enum_column(PropertyContactType, "property_contact_type"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Brokerage firm or an owning company; null for individual owners.
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # One contact, many phone entries.
    phones: Mapped[list["PropertyContactPhone"]] = relationship(
        back_populates="property_contact",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # One contact can be linked to multiple properties.
    properties: Mapped[list["Property"]] = relationship(
        back_populates="property_contact",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<PropertyContact {self.full_name!r} ({self.contact_type.value})>"


class PropertyContactPhone(Base):
    __tablename__ = "property_contact_phones"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_contact_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("property_contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    # Human-readable hint, e.g. "mobile", "office", "home".
    label: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_whatsapp: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    property_contact: Mapped["PropertyContact"] = relationship(
        back_populates="phones"
    )

    def __repr__(self) -> str:
        tag = " (WA)" if self.is_whatsapp else ""
        return f"<PropertyContactPhone {self.phone!r}{tag}>"
