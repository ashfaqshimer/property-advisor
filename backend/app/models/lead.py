"""The `leads` table.

What the agent's `capture_lead` tool writes. Every field except the conversation is
nullable, because a lead is assembled over several turns rather than arriving complete.
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models._enum import enum_column


class LeadIntent(str, enum.Enum):
    """Which side of the transaction this person is on.

    NOT IN PROJECT_OVERVIEW.md §4 — added when the agent persona grew a seller lane. The
    alternative was recording "wants to sell" inside the free-text `preferences` blob,
    which makes "show me every seller lead" a substring search over prose.
    """

    BUY = "buy"
    RENT = "rent"
    SELL = "sell"


class LeadInterest(str, enum.Enum):
    """What the lead wants to buy, rent, or sell."""

    APARTMENT_SALE = "apartment_sale"
    APARTMENT_RENT = "apartment_rent"
    HOUSE_SALE = "house_sale"
    HOUSE_RENT = "house_rent"
    LAND = "land"
    SELLING = "selling"
    OTHER = "other"


class LeadSource(str, enum.Enum):
    """How a lead first entered the system."""

    AI_AGENT = "ai_agent"
    MANUAL = "manual"
    FALLBACK = "fallback"


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

    # Nullable like the rest: intent is often clear from the first message, but not always,
    # and guessing it wrong is worse than leaving it unset. Indexed because the point of
    # having the column at all is "show me the sellers".
    intent: Mapped[LeadIntent | None] = mapped_column(
        enum_column(LeadIntent, "lead_intent"), nullable=True, index=True
    )

    source: Mapped[LeadSource | None] = mapped_column(
        enum_column(LeadSource, "lead_source"), nullable=True, index=True
    )

    edited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("staff_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Free-form requirements the agent distils from the conversation, not a structured filter.
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)

    interest: Mapped[LeadInterest | None] = mapped_column(
        enum_column(LeadInterest, "lead_interest"), nullable=True, index=True
    )

    # Operational notes for important context that should not be treated as a search filter.
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # UNIQUE: one lead per conversation. This is what makes a second `capture_lead` call an
    # update rather than a duplicate row — enforced here rather than by trusting the model
    # to call the tool exactly once.
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=True,
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
    edited_by: Mapped["StaffUser | None"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return f"<Lead {self.name!r} {self.phone!r}>"
