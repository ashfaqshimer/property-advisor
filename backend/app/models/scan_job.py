import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, Uuid, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

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
    
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    created_by_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<ScanJob {self.id!s} - {self.job_type} - {self.status}>"
