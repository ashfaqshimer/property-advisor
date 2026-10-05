import uuid
from datetime import datetime

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FieldAssignment(Base):
    __tablename__ = "field_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    prospect_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("prospects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID,
        ForeignKey("staff_users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # pending | no_answer | interested | not_interested | callback_later
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Telegram message tracking
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    awaiting_notes: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    prospect = relationship("Prospect", foreign_keys=[prospect_id])
    assigned_by = relationship("StaffUser", foreign_keys=[assigned_by_id])

    def __repr__(self) -> str:
        return f"<FieldAssignment {self.id!s} prospect={self.prospect_id!s} status={self.status}>"
