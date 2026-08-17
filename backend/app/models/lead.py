"""The `leads` table.

What the agent's `capture_lead` tool writes. Every field except the conversation is
nullable, because a lead is assembled over several turns rather than arriving complete.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Nullable until captured. The agent works toward a name and phone over the course of a
    # conversation rather than demanding them upfront, so a partial lead is a valid row and
    # not an error state.
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Same 14,2 as properties.price, so a budget and a listing price are directly
    # comparable without a cast.
    budget_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    budget_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    # Free-form notes the agent distils from the conversation, not a structured filter.
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)

    # UNIQUE: one lead per conversation. This is what makes a second `capture_lead` call an
    # update rather than a duplicate row — enforced here rather than by trusting the model
    # to call the tool exactly once.
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    # NOT IN THE SPEC — deliberate addition. Because `capture_lead` fills a row in across
    # turns, `created_at` alone can't distinguish a stale partial lead from one that just
    # gained a phone number. `onupdate` fires on ORM-issued UPDATEs.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    conversation: Mapped["Conversation"] = relationship(  # noqa: F821
        back_populates="lead"
    )

    def __repr__(self) -> str:
        return f"<Lead {self.name!r} {self.phone!r}>"
