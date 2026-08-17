"""The `conversations` / `messages` / `leads` tables.

Runs on in-memory SQLite. What that genuinely covers is more than the properties retro
assumed: SQLite enforces both UNIQUE and CHECK constraints, and it enforces foreign keys
too once `tests/conftest.py` sets `PRAGMA foreign_keys=ON`.

What it still does not cover: `Numeric` Decimal fidelity (SQLite has no native Decimal —
`pyproject.toml` suppresses SQLAlchemy's warning about exactly that), and whether the
shipped Postgres DDL matches these intentions. Both are verified by hand against Neon;
commands in backend/README.md.
"""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Conversation, Lead, Message, MessageRole


def _conversation(session: Session, session_id: str = "sess-1") -> Conversation:
    conversation = Conversation(session_id=session_id)
    session.add(conversation)
    session.commit()
    return conversation


def _message(conversation: Conversation, seq: int, **kwargs) -> Message:
    kwargs.setdefault("role", MessageRole.USER)
    kwargs.setdefault("content", f"turn {seq}")
    return Message(conversation_id=conversation.id, seq=seq, **kwargs)


class TestConversation:
    def test_round_trips(self, db_session: Session):
        conversation = _conversation(db_session)
        assert isinstance(conversation.id, uuid.UUID)
        assert conversation.created_at is not None

    def test_duplicate_session_id_rejected(self, db_session: Session):
        """A second row for one session would silently fork the conversation, and the
        agent would answer with half the history."""
        _conversation(db_session, "sess-dup")
        db_session.add(Conversation(session_id="sess-dup"))
        with pytest.raises(IntegrityError):
            db_session.commit()


class TestMessageOrdering:
    def test_messages_round_trip_in_seq_order(self, db_session: Session):
        """Inserted out of order on purpose — `seq` is what orders them, and every row
        here shares a `created_at` because they land in one transaction."""
        conversation = _conversation(db_session)
        db_session.add_all(
            [_message(conversation, seq) for seq in (2, 0, 3, 1)]
        )
        db_session.commit()
        db_session.refresh(conversation)

        assert [m.seq for m in conversation.messages] == [0, 1, 2, 3]
        assert [m.content for m in conversation.messages] == [
            "turn 0",
            "turn 1",
            "turn 2",
            "turn 3",
        ]

    def test_created_at_alone_cannot_order_one_transaction(self, db_session: Session):
        """Why `seq` exists — a record of the behaviour, not a guard on our own code.

        Note this passes here for a *different reason* than it would on Postgres, so it is
        not evidence for the production case: SQLite's CURRENT_TIMESTAMP is statement time
        at one-second resolution, while Postgres now() is transaction-start time. Rows
        written in one pass of the agent loop collide either way, which is the only point
        that matters for choosing a sort key.
        """
        conversation = _conversation(db_session)
        db_session.add_all([_message(conversation, seq) for seq in range(3)])
        db_session.commit()

        stamps = db_session.scalars(
            select(Message.created_at).where(
                Message.conversation_id == conversation.id
            )
        ).all()
        assert len(set(stamps)) < len(stamps), (
            "timestamps came out distinct; if this ever fails, re-check whether `seq` is "
            "still load-bearing on this backend"
        )

    def test_duplicate_seq_in_one_conversation_rejected(self, db_session: Session):
        conversation = _conversation(db_session)
        db_session.add_all([_message(conversation, 0), _message(conversation, 0)])
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_same_seq_across_conversations_allowed(self, db_session: Session):
        """The constraint is per conversation, not global — every conversation starts at 0."""
        first = _conversation(db_session, "sess-a")
        second = _conversation(db_session, "sess-b")
        db_session.add_all([_message(first, 0), _message(second, 0)])
        db_session.commit()

        assert db_session.scalar(select(Message).where(Message.seq == 0)) is not None
        assert len(db_session.scalars(select(Message)).all()) == 2


class TestMessageRole:
    def test_role_persists_lowercase_value_not_member_name(self, db_session: Session):
        """The `values_callable` trap. Read back as raw SQL, because the ORM would map
        either spelling back to the same enum member and hide the bug."""
        conversation = _conversation(db_session)
        db_session.add(_message(conversation, 0, role=MessageRole.ASSISTANT))
        db_session.commit()

        assert db_session.scalar(text("SELECT role FROM messages")) == "assistant"

    def test_check_constraint_rejects_member_name(self, db_session: Session):
        """SQLite does enforce CHECK constraints, so this trap is catchable here rather
        than only against Neon. The emitted DDL reads IN ('user', 'assistant', 'tool')."""
        conversation = _conversation(db_session)
        with pytest.raises(IntegrityError):
            db_session.execute(
                text(
                    "INSERT INTO messages (id, conversation_id, role, content, seq) "
                    "VALUES (:id, :cid, 'USER', '', 0)"
                ),
                {"id": uuid.uuid4().hex, "cid": conversation.id.hex},
            )


class TestToolPayload:
    def test_round_trips_a_dict(self, db_session: Session):
        conversation = _conversation(db_session)
        payload = {
            "name": "search_properties",
            "args": {"location": "Colombo 5", "budget_max": 45000000},
        }
        db_session.add(
            _message(conversation, 0, role=MessageRole.TOOL, content="", tool_payload=payload)
        )
        db_session.commit()
        db_session.expire_all()

        stored = db_session.scalar(select(Message))
        assert stored.tool_payload == payload
        assert stored.tool_payload["args"]["location"] == "Colombo 5"

    def test_defaults_to_none_for_ordinary_turns(self, db_session: Session):
        conversation = _conversation(db_session)
        db_session.add(_message(conversation, 0))
        db_session.commit()

        assert db_session.scalar(select(Message)).tool_payload is None

    def test_content_defaults_to_empty_string_not_null(self, db_session: Session):
        """A tool turn has no prose, but the row should never be both empty and null."""
        conversation = _conversation(db_session)
        db_session.add(
            Message(conversation_id=conversation.id, seq=0, role=MessageRole.TOOL)
        )
        db_session.commit()

        assert db_session.scalar(select(Message)).content == ""


class TestLead:
    def test_partial_lead_is_valid(self, db_session: Session):
        """The agent works toward a name and phone over several turns, so a row with
        neither is a legitimate intermediate state."""
        conversation = _conversation(db_session)
        db_session.add(Lead(conversation_id=conversation.id, preferences="wants a garden"))
        db_session.commit()

        lead = db_session.scalar(select(Lead))
        assert lead.name is None
        assert lead.phone is None
        assert lead.budget_min is None
        assert lead.created_at is not None
        assert lead.updated_at is not None

    def test_second_lead_for_one_conversation_rejected(self, db_session: Session):
        """What makes a repeat `capture_lead` call an update instead of a duplicate row."""
        conversation = _conversation(db_session)
        db_session.add(Lead(conversation_id=conversation.id, name="First"))
        db_session.commit()

        db_session.add(Lead(conversation_id=conversation.id, name="Second"))
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_budget_round_trips(self, db_session: Session):
        """Decimal *fidelity* is a Postgres concern — SQLite has no native Decimal. This
        only checks the values survive the round trip at all."""
        conversation = _conversation(db_session)
        db_session.add(
            Lead(
                conversation_id=conversation.id,
                budget_min=Decimal("15000000.00"),
                budget_max=Decimal("45000000.00"),
            )
        )
        db_session.commit()
        db_session.expire_all()

        lead = db_session.scalar(select(Lead))
        assert Decimal(str(lead.budget_min)) == Decimal("15000000.00")
        assert Decimal(str(lead.budget_max)) == Decimal("45000000.00")

    def test_one_to_one_relationship(self, db_session: Session):
        conversation = _conversation(db_session)
        db_session.add(Lead(conversation_id=conversation.id, name="Nimal"))
        db_session.commit()
        db_session.refresh(conversation)

        assert conversation.lead is not None
        assert conversation.lead.name == "Nimal"


class TestCascadeDelete:
    def test_deleting_conversation_clears_messages_and_lead(self, db_session: Session):
        """Exercises the database's ON DELETE CASCADE, not SQLAlchemy's own bookkeeping —
        the relationships set `passive_deletes=True`. Requires the `PRAGMA foreign_keys=ON`
        in conftest; without it SQLite ignores foreign keys and both rows survive.
        """
        conversation = _conversation(db_session)
        db_session.add_all(
            [
                _message(conversation, 0),
                _message(conversation, 1),
                Lead(conversation_id=conversation.id, name="Nimal"),
            ]
        )
        db_session.commit()

        db_session.delete(conversation)
        db_session.commit()

        assert db_session.scalars(select(Message)).all() == []
        assert db_session.scalars(select(Lead)).all() == []

    def test_orphan_message_rejected(self, db_session: Session):
        """The other half of FK enforcement: a message must point at a real conversation."""
        db_session.add(
            Message(conversation_id=uuid.uuid4(), seq=0, role=MessageRole.USER)
        )
        with pytest.raises(IntegrityError):
            db_session.commit()
