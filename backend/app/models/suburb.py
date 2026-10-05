import uuid
from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Float, Integer, Numeric, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class Suburb(Base):
    __tablename__ = "suburbs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    district: Mapped[str] = mapped_column(String(64), index=True, default="Colombo")
    ds_division: Mapped[str | None] = mapped_column(String(128), nullable=True)  # CBSL 13 Divisional Secretariats
    tier: Mapped[str] = mapped_column(String(64), default="Outer Commuter")  # Prime Colombo, Inner Suburbs, etc.
    
    # Aliases for flexible matching
    aliases: Mapped[list[str]] = mapped_column(
        ARRAY(Text).with_variant(JSON(), "sqlite"),
        default=list,
    )

    # Optional geospatial coordinates for centroid
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Macro baseline values (seeded from CBSL Land Valuation Indicator & LPW Benchmarks)
    baseline_land_perch_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    baseline_land_perch_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    baseline_apartment_sqft_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    baseline_apartment_sqft_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Suburb {self.name} ({self.district})>"
