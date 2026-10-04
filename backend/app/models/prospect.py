import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, SmallInteger, String, Text, Uuid, func, Float, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base


class Prospect(Base):
    __tablename__ = "prospects"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    # ikman identifiers
    ikman_ad_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    ikman_url: Mapped[str] = mapped_column(Text)
    ikman_slug: Mapped[str] = mapped_column(String(256))
    
    # Listing data
    title: Mapped[str] = mapped_column(Text)
    price: Mapped[str] = mapped_column(String(128))
    location: Mapped[str] = mapped_column(String(128))
    suburb: Mapped[str | None] = mapped_column(String(128), nullable=True)
    suburb_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    property_type: Mapped[str] = mapped_column(String(64))   # land, house, apartment
    listing_type: Mapped[str] = mapped_column(String(32))     # for_sale, for_rent
    
    # Contact
    poster_name: Mapped[str | None] = mapped_column(String(128))
    phone_number: Mapped[str | None] = mapped_column(String(32))
    
    # Classification
    classification: Mapped[str] = mapped_column(String(16))   # owner, broker
    confidence: Mapped[int] = mapped_column(SmallInteger)      # 0-100
    classification_reasons: Mapped[list[str]] = mapped_column(
        ARRAY(Text).with_variant(JSON(), "sqlite")
    )
    classification_method: Mapped[str] = mapped_column(String(16))  # heuristic, llm, hybrid
    
    # Workflow
    # new       – just discovered, not yet contacted
    # contacted – outreach made, outcome pending
    # converted – converted to a full property listing
    # discarded – rejected/ignored/closed (with discard_reason: misclassified_broker, not_interested, out_of_area, already_sold, unreachable, duplicate)
    status: Mapped[str] = mapped_column(String(32), default="new")
    
    # Timestamps
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    # ikman metadata (for de-dup and classification)
    is_member: Mapped[bool] = mapped_column(Boolean, default=False)
    is_auth_dealer: Mapped[bool] = mapped_column(Boolean, default=False)
    membership_level: Mapped[str] = mapped_column(String(16), default="free")
    shop_name: Mapped[str | None] = mapped_column(String(256))

    # Provenance
    first_scan_job_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("scan_jobs.id"), nullable=True, index=True
    )
    discard_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_scan_job = relationship("ScanJob", back_populates="prospects", foreign_keys=[first_scan_job_id])

    def __repr__(self) -> str:
        return f"<Prospect {self.id!s}>"
