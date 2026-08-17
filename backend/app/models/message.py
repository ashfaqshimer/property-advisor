"""The `messages` table.

One row per turn in a conversation, including tool turns. Two columns here are not in
PROJECT_OVERVIEW.md §4 and both are deliberate — see `seq` and `tool_payload`.
"""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base
from app.models._enum import enum_column


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Message(Base):
    __tablename__ = "messages"

    # A duplicate (conversation_id, seq) is a bug in whatever assigned the sequence, and
    # the resulting ambiguity is invisible until a replayed conversation comes back
    # scrambled. Cheaper to reject at write time.
    __table_args__ = (UniqueConstraint("conversation_id", "seq"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[MessageRole] = mapped_column(
        enum_column(MessageRole, "message_role"), nullable=False
    )

    # Not nullable, defaulting to "": a row is then never both empty and null. A tool turn
    # legitimately has no prose, and in that case `tool_payload` carries the meaning.
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # NOT IN THE SPEC — deliberate addition. §4 lists only `content` text, which cannot
    # faithfully replay a Gemini function_call / function_response pair: the call's
    # arguments and the tool's return value are structured, and flattening them to prose
    # loses what the model needs to see on the next turn. Dialect-agnostic JSON rather than
    # JSONB because nothing queries inside it — it is read back wholesale to rebuild
    # `contents`. Assign a new dict to change it; in-place mutation is not tracked.
    tool_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # NOT IN THE SPEC — deliberate addition, and the ordering key. §4 implies `created_at`
    # ordering, which does not hold here: one pass of the agent loop writes a user turn, a
    # tool turn, and an assistant turn inside a single transaction, and Postgres now() is
    # transaction-start time, so all three share a timestamp. The random UUID `id` is no
    # tiebreaker either. This is the same trap the seeded properties hit, but the
    # consequence is worse than a nondeterministic grid — it replays a scrambled
    # conversation back to the model. `created_at` stays, as information rather than order.
    seq: Mapped[int] = mapped_column(nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship(  # noqa: F821
        back_populates="messages"
    )

    def __repr__(self) -> str:
        return f"<Message {self.role.value} seq={self.seq}>"
