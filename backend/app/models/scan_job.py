import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, Uuid, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_type: Mapped[str] = mapped_column(String(32))  # e.g., 'scan', 'phone_fetch'
    status: Mapped[str] = mapped_column(String(32), default="running")  # running, completed, failed
    progress: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str | None] = mapped_column(Text)
    
    # Target & Scoping
    source: Mapped[str] = mapped_column(String(32), default="ikman", server_default="ikman", index=True)
    keyword: Mapped[str | None] = mapped_column(String(128), nullable=True)
    property_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Outcome Metrics
    pages_scanned: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_pages: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_found: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    new_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    updated_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    filtered_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    created_by_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    prospects = relationship("Prospect", back_populates="first_scan_job", foreign_keys="Prospect.first_scan_job_id")

    def __repr__(self) -> str:
        return f"<ScanJob {self.id!s} - {self.job_type} - {self.status}>"
