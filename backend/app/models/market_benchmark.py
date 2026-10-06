"""The `market_benchmarks` table.

Stores localized baseline property rates (e.g. rate per sqft or per perch)
used by the AI agent and the prospect evaluation system.
"""

import uuid
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import DateTime, Numeric, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketBenchmark(Base):
    __tablename__ = "market_benchmarks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    location: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    property_type: Mapped[str] = mapped_column(String(32), nullable=False)
    listing_type: Mapped[str] = mapped_column(String(16), nullable=False)

    rate_per_sqft: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    rate_per_perch: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default="active")

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "location",
            "property_type",
            "listing_type",
            name="uq_market_benchmarks_loc_type",
        ),
    )

    def __repr__(self) -> str:
        return f"<MarketBenchmark {self.location} {self.property_type}/{self.listing_type}: sqft={self.rate_per_sqft}>"
