"""The `properties` table.

Mirrors PROJECT_OVERVIEW.md §4 with one addition and no removals — see `image_alt`.
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base
from app.models._enum import enum_column


class PropertyType(str, enum.Enum):
    HOUSE = "house"
    APARTMENT = "apartment"
    LAND = "land"
    COMMERCIAL = "commercial"


class PropertyStatus(str, enum.Enum):
    AVAILABLE = "available"
    UNDER_OFFER = "under_offer"
    SOLD = "sold"


class Property(Base):
    __tablename__ = "properties"

    # Python-side default rather than server_default=gen_random_uuid(): the id is
    # then available before flush, and the model stays creatable on SQLite in tests.
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # LKR. 14,2 tops out just under a trillion rupees — three orders of magnitude
    # above the priciest listing — while keeping cents for the day a rental or a
    # per-perch land price needs them.
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, index=True)

    location: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    property_type: Mapped[PropertyType] = mapped_column(
        enum_column(PropertyType, "property_type"), nullable=False, index=True
    )

    # Nullable: land and commercial listings have none of these.
    bedrooms: Mapped[int | None] = mapped_column(nullable=True)
    bathrooms: Mapped[int | None] = mapped_column(nullable=True)
    sqft: Mapped[int | None] = mapped_column(nullable=True)

    # A Postgres array, per spec — the honest type for a list of scalars, and it keeps
    # `= ANY(image_urls)` available. The sqlite variant exists purely so the test suite
    # can build this table without a Postgres. Assign a new list to change it;
    # in-place .append() is not tracked.
    image_urls: Mapped[list[str]] = mapped_column(
        ARRAY(Text).with_variant(JSON(), "sqlite"), nullable=False, default=list
    )

    # NOT IN THE SPEC — deliberate addition. Alt text describes the photograph, not the
    # listing, so it cannot be derived from `title` (frontend/tests/property-grid.test.tsx
    # asserts exactly that). Describes image_urls[0]; becomes per-image when a gallery
    # lands.
    image_alt: Mapped[str] = mapped_column(Text, nullable=False, default="")

    status: Mapped[PropertyStatus] = mapped_column(
        enum_column(PropertyStatus, "property_status"),
        nullable=False,
        default=PropertyStatus.AVAILABLE,
        server_default=PropertyStatus.AVAILABLE.value,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    def __repr__(self) -> str:
        return f"<Property {self.title!r} {self.location!r}>"
