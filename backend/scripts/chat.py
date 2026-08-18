"""Talk to Amaya from the terminal.

    uv run python -m scripts.chat            # throwaway SQLite, seeded listings
    uv run python -m scripts.chat --verbose  # also show the tool-calling loop
    uv run python -m scripts.chat --neon     # the real Neon database

`POST /chat` doesn't exist yet (Phase 3), so this is how the agent is exercised by hand.
It calls exactly what the endpoint will call — `loop.run_turn` — so anything reproducible
here is reproducible there.

**Defaults to an in-memory database on purpose.** Every turn writes rows to `conversations`,
`messages`, and `leads`, and a few minutes of poking around would otherwise leave a trail
of fake leads in the production database that look exactly like real ones. Pass `--neon`
when you specifically want to check persistence against Postgres.
"""

from __future__ import annotations

import argparse
import uuid

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  — registers every table on Base.metadata
from app.agent.client import GeminiNotConfigured, get_gemini_client
from app.agent.loop import run_turn
from app.db.base import Base
from app.db.seed import seed_into
from app.db.session import SessionLocal
from app.models import Lead, Message, MessageRole

BOLD, DIM, GREEN, YELLOW, RESET = "\033[1m", "\033[2m", "\033[32m", "\033[33m", "\033[0m"


def _memory_sessions() -> sessionmaker[Session]:
    """In-memory SQLite with the eight real listings, so searches return real results."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, _record):
        # SQLite ignores foreign keys per connection without this.
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as session:
        seed_into(session)
        session.commit()
    return factory


def _show_loop(db: Session, session_id: str, from_seq: int) -> int:
    """Print the tool calls made since `from_seq`, and return the new high-water mark.

    This is the hand-rolled loop made visible — the function_call the model chose, the
    payload the tool sent back. Worth watching at least once.
    """
    rows = list(
        db.execute(
            select(Message)
            .join(Message.conversation)
            .where(Message.seq >= from_seq)
            .order_by(Message.seq)
        ).scalars()
    )
    for row in rows:
        payload = row.tool_payload or {}
        if call := payload.get("function_call"):
            print(f"  {DIM}→ {call['name']}({call['args']}){RESET}")
        elif response := payload.get("function_response"):
            body = response["response"]
            if "match_count" in body:
                summary = f"{body['match_count']} match(es)"
                if body.get("guidance"):
                    summary += "  + guidance: don't claim we have nothing"
            elif "error" in body:
                summary = f"error: {body['error']}"
            else:
                summary = str(body)[:100]
            print(f"  {DIM}← {summary}{RESET}")
    return max((row.seq for row in rows), default=from_seq - 1) + 1


def _print_lead(db: Session) -> None:
    lead = db.execute(select(Lead)).scalars().first()
    if lead is None:
        print(f"{DIM}(no lead captured){RESET}")
        return
    intent = lead.intent.value if lead.intent else None
    print(
        f"{YELLOW}lead captured:{RESET} name={lead.name!r} phone={lead.phone!r} "
        f"intent={intent!r}\n  preferences={lead.preferences!r}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Chat with Amaya in the terminal.")
    parser.add_argument(
        "--neon",
        action="store_true",
        help="use the real DATABASE_URL instead of throwaway in-memory SQLite",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="show each function_call and tool result as the loop runs",
    )
    parser.add_argument(
        "--session",
        default=None,
        help="session id to continue (default: a fresh random one)",
    )
    args = parser.parse_args()

    try:
        client = get_gemini_client()
    except GeminiNotConfigured as exc:
        raise SystemExit(f"{exc}")

    session_id = args.session or f"cli-{uuid.uuid4().hex[:8]}"
    factory = SessionLocal if args.neon else _memory_sessions()
    where = "Neon" if args.neon else "in-memory SQLite (seeded, throwaway)"

    print(f"{BOLD}Amaya{RESET} — {client.model} against {where}")
    print(f"{DIM}session {session_id} · Ctrl-D or 'quit' to leave{RESET}")
    if args.neon:
        print(
            f"{YELLOW}writing to the real database — this conversation and any lead it "
            f"captures will persist{RESET}"
        )
    print()

    seq = 0
    with factory() as db:
        while True:
            try:
                message = input(f"{BOLD}you ›{RESET} ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if not message:
                continue
            if message.lower() in {"quit", "exit"}:
                break

            try:
                reply = run_turn(db, session_id, message, client=client)
            except Exception as exc:  # noqa: BLE001 - a dev CLI should not traceback-spam
                print(f"  {YELLOW}{type(exc).__name__}: {exc}{RESET}\n")
                continue

            if args.verbose:
                seq = _show_loop(db, session_id, seq)
            else:
                seq = (
                    db.execute(select(Message.seq).order_by(Message.seq.desc())).scalar()
                    or 0
                ) + 1
            print(f"{GREEN}amaya ›{RESET} {reply}\n")

        print()
        _print_lead(db)
        turns = db.execute(
            select(Message).where(Message.role != MessageRole.TOOL)
        ).scalars()
        print(f"{DIM}{len(list(turns))} non-tool turns persisted · session {session_id}{RESET}")


if __name__ == "__main__":
    main()
