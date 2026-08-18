# Home Advisor API

FastAPI + SQLAlchemy + Alembic against Neon Postgres. See
[../context/PROJECT_OVERVIEW.md](../context/PROJECT_OVERVIEW.md) for the full spec.

## Setup

Dependencies are managed with **uv** and `pyproject.toml` — not `requirements.txt`,
which PROJECT_OVERVIEW §3 mentions. The lockfile is the better reproducibility story
and Render supports it directly.

```bash
cd backend
cp .env.example .env      # paste your Neon connection string into DATABASE_URL
uv sync
```

Use Neon's **direct** (non-pooled) endpoint and keep `?sslmode=require` — Neon refuses
unencrypted connections and the error it returns doesn't say so. If you must use the
`-pooler` endpoint, set `MIGRATION_DATABASE_URL` to the direct string as well, and add
`connect_args={"prepare_threshold": None}` in `app/db/session.py` (PgBouncer's
transaction pooling breaks psycopg3's named prepared statements).

## Running

```bash
uv run alembic upgrade head        # create/update tables
uv run python -m app.db.seed       # 8 sample listings; safe to re-run
uv run fastapi dev app/main.py     # http://127.0.0.1:8000 — /docs for Swagger
uv run pytest
```

## Talking to the agent

`POST /chat` doesn't exist yet (Phase 3), so there's no way in through `/docs` or the
frontend. Use the terminal REPL — it calls the same `loop.run_turn` the endpoint will:

```bash
uv run python -m scripts.chat             # throwaway in-memory SQLite, seeded listings
uv run python -m scripts.chat --verbose    # also print each function_call and tool result
uv run python -m scripts.chat --neon       # the real database
uv run python -m scripts.chat --session cli-abc123   # resume a conversation
```

Needs `GEMINI_API_KEY` in `.env`; without it you get a named error naming the variable
rather than an SDK stacktrace.

**It defaults to in-memory SQLite deliberately.** Every turn writes to `conversations`,
`messages`, and `leads`, so ten minutes of poking around against `--neon` leaves a trail of
fake leads that look exactly like real ones. Use `--neon` when you're specifically checking
Postgres persistence, and expect to clean up after yourself.

`--verbose` is the one worth running at least once: it shows the hand-rolled loop choosing a
tool, the payload coming back, and — on a search that matches nothing — the guidance that
stops the model claiming we have no properties in an area.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Smoke test |
| GET | `/properties/featured` | Homepage grid — newest available listings (`?limit=1..24`) |

`price` is a raw JSON number with a separate `currency` field; formatting is the
frontend's job. Field names are snake_case, matching the columns.

## Migrations

The connection string comes from `app/config.py`, not `alembic.ini` — `sqlalchemy.url`
there is deliberately empty.

```bash
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
uv run alembic downgrade base && uv run alembic upgrade head   # prove it reverses
```

Always read a generated migration before applying it. In particular the enum columns must
render as `VARCHAR` + named CHECK, not `postgresql.ENUM`.

`alembic/env.py` filters the enums' CHECK constraints out of autogenerate via
`include_object`. Without it, every run emits `op.drop_constraint` for constraints that are
in fact present and correct: Alembic 1.19 reflects CHECK constraints from the database, but
the ones `Enum(native_enum=False, create_constraint=True)` attaches are `_type_bound` and
are excluded from the model side of the comparison, so the database looks ahead of the
models. The filter matches on name, because for a *removed* constraint the object handed to
`include_object` is the reflected one and carries no `_type_bound` flag. **If a future
migration wants to drop `ck_*_property_type`, `ck_*_property_status`, or
`ck_messages_message_role`, that is this bug, not a real diff.**

## Tests

`uv run pytest` runs against in-memory SQLite with `get_db` overridden — no network, no
database. SQLite does enforce UNIQUE and CHECK constraints, and enforces foreign keys via
the `PRAGMA foreign_keys=ON` that `tests/conftest.py` sets, so constraint behaviour is
covered there.

It does **not** exercise the real Postgres `ARRAY` type, `Numeric` Decimal fidelity
(SQLite has no native Decimal), or whether the shipped DDL matches the models. There is no
`psql` on this machine, so verify those through SQLAlchemy:

```bash
# properties: ARRAY type and enum values
uv run python -c "
from app.db.session import SessionLocal
from sqlalchemy import text
with SessionLocal() as s:
    print(s.execute(text('select property_type, count(*), array_length(image_urls,1) from properties group by 1,3')).all())
"
# [('apartment', 2, 1), ('house', 6, 1)]

# chat tables: shipped DDL — enum CHECK, both cascades, both uniques
uv run python -c "
from app.db.session import engine
from sqlalchemy import text
with engine.connect() as c:
    for q in [
        \"select conname, pg_get_constraintdef(oid) from pg_constraint where contype in ('c','f','u') and conrelid in ('messages'::regclass,'leads'::regclass) order by 1\",
        \"select indexdef from pg_indexes where indexname='ix_conversations_session_id'\",
    ]:
        for row in c.execute(text(q)): print(row)
"
# ck_messages_message_role  CHECK ((role)::text = ANY (ARRAY['user','assistant','tool']::text[]))
# fk_leads_conversation_id_conversations     FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
# fk_messages_conversation_id_conversations  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
# uq_leads_conversation_id     UNIQUE (conversation_id)
# uq_messages_conversation_id  UNIQUE (conversation_id, seq)
# CREATE UNIQUE INDEX ix_conversations_session_id ON public.conversations USING btree (session_id)

# leads: Numeric(14,2) keeps Decimal exact — write, read back, cascade-delete to clean up
uv run python -c "
from decimal import Decimal
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.db.session import engine
from app.models import Conversation, Lead
with Session(engine) as s:
    c = Conversation(session_id='verify-numeric'); s.add(c); s.commit()
    s.add(Lead(conversation_id=c.id, budget_min=Decimal('15000000.01'))); s.commit()
    lead = s.scalar(select(Lead).where(Lead.conversation_id == c.id))
    print(repr(lead.budget_min), lead.budget_min == Decimal('15000000.01'))
    s.execute(delete(Conversation).where(Conversation.id == c.id)); s.commit()
"
# Decimal('15000000.01') True
```

Note the last snippet writes to Neon and relies on the cascade to clean up after itself —
deleting the conversation removes the lead. Check `select count(*) from leads` is back to
where it started if it errors partway.

## Deploying (Render)

Not yet done. When it is: build with `uv sync --frozen --no-dev`, start with
`uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and run
`uv run alembic upgrade head` as a pre-deploy command. Render's free tier spins down
when idle, so the first request after inactivity is slow — expected, not a bug.
