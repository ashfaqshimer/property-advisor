"""The `conversations` table.

One row per browser session. `session_id` is client-generated and is what a `POST /chat`
request will look a conversation up by, so it carries the uniqueness — the UUID `id` is
for foreign keys.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    # Python-side default rather than server_default=gen_random_uuid(): the id is then
    # available before flush, and the model stays creatable on SQLite in tests.
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Unique because the lookup is get-or-create by session: a second row for the same
    # session would silently fork the conversation, and the agent would answer with half
    # the history. 128 is well clear of a UUID string (36) or a nanoid (21).
    session_id: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    # `passive_deletes=True` is load-bearing: without it SQLAlchemy loads the children on
    # delete and issues its own DELETEs, which would mask whether the database-level
    # ON DELETE CASCADE actually works. With it, the cascade is the database's job.
    messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        back_populates="conversation",
        order_by="Message.seq",
        cascade="all, delete",
        passive_deletes=True,
    )

    # uselist=False — one lead per conversation, enforced by a UNIQUE on the FK.
    lead: Mapped["Lead | None"] = relationship(  # noqa: F821
        back_populates="conversation",
        uselist=False,
        cascade="all, delete",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Conversation {self.session_id!r}>"
