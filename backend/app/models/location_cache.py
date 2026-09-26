from datetime import datetime

from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LocationCache(Base):
    __tablename__ = "location_cache"

    # We use the raw location string directly as the PK for fast lookups
    location_string: Mapped[str] = mapped_column(String(256), primary_key=True)
    
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<LocationCache {self.location_string!r}>"
