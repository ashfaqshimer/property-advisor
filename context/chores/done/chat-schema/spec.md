# Spec: Chat Schema (conversations, messages, leads)

## Goal

Add the three remaining tables from `PROJECT_OVERVIEW.md` §4 — `conversations`,
`messages`, `leads` — as SQLAlchemy models plus one Alembic migration, so the Phase 2
agent core has somewhere to persist a conversation and write a captured lead. Database
layer only: no agent code, no endpoints.

## Why this is its own chore

Phase 2 in the overview bundles the agent loop with its tools, but `capture_lead` has no
table to write to and the loop has nowhere to persist turns. The `properties` migration
turned up three non-obvious traps (`values_callable` on enums, transaction-time `now()`,
the SQLite variant for `ARRAY`); landing three more tables and verifying them against
Neon on their own beats debugging schema and a hand-rolled tool-calling loop in the same
branch.

## Acceptance Criteria

### Models

- [ ] `backend/app/models/conversation.py` defines `Conversation` with: `id` (UUID PK,
      Python-side `uuid.uuid4` default), `session_id` (String, **unique**, indexed,
      not null), `created_at` (timestamptz, `server_default=func.now()`, indexed).
- [ ] `backend/app/models/message.py` defines `Message` with: `id` (UUID PK),
      `conversation_id` (FK → `conversations.id`, **`ondelete="CASCADE"`**, indexed,
      not null), `role` (enum `user | assistant | tool`), `content` (Text, not null,
      default `""`), `tool_payload` (JSON, **nullable**), `seq` (int, not null),
      `created_at` (timestamptz, `server_default=func.now()`).
- [ ] `Message` has a `UniqueConstraint("conversation_id", "seq")` so ordering within one
      conversation is unambiguous.
- [ ] `backend/app/models/lead.py` defines `Lead` with: `id` (UUID PK), `name`
      (String, nullable), `phone` (String, nullable), `budget_min` / `budget_max`
      (`Numeric(14, 2)`, nullable), `preferences` (Text, nullable),
      `conversation_id` (FK → `conversations.id`, **unique**, `ondelete="CASCADE"`,
      not null), `created_at` and `updated_at` (timestamptz).
- [ ] `MessageRole` is built with the same VARCHAR + named-CHECK helper the `properties`
      enums use, including `values_callable` — the column stores `"user"`, never `"USER"`.
- [ ] That helper is shared, not copy-pasted: `_enum_column` moves out of
      `app/models/property.py` into a module both files import, and `property.py` is
      updated to import it. No behaviour change to the `properties` table.
- [ ] `app/models/__init__.py` exports `Conversation`, `Message`, `MessageRole`, `Lead`
      alongside the existing `Property` exports, so Alembic's one-import registration
      still picks up every table.

### Migration

- [ ] One new Alembic revision creates all three tables, with `down_revision` pointing at
      the `create_properties_table` revision.
- [ ] Tables are created in FK-safe order (`conversations` before `messages` / `leads`),
      and `downgrade()` drops them in reverse.
- [ ] `uv run alembic upgrade head` then `uv run alembic downgrade -1` both succeed
      against Neon, leaving the `properties` table untouched. Neon is live and currently at
      revision `da5c830b686e` with only `alembic_version` and `properties` present, so this
      runs against a known starting state. If `DATABASE_URL` points at a `-pooler`
      endpoint, `MIGRATION_DATABASE_URL` must carry the direct one — `config.py` already
      has the split for this reason.
- [ ] `uv run alembic check` reports no pending autogenerate diff after the upgrade —
      the models and the migration agree.

### Tests (in-memory SQLite — verified reachable, see Notes)

- [ ] **`tests/conftest.py`'s `db_session` fixture turns on FK enforcement** with a
      `PRAGMA foreign_keys=ON` listener on connect. SQLite ignores foreign keys entirely
      without it — measured: deleting a parent left the child row in place, so a cascade
      test fails misleadingly, looking like a broken model rather than an unenforced
      pragma. `properties` has no FKs, so this cannot disturb the existing 31 tests.
- [ ] A conversation with several messages round-trips in `seq` order.
- [ ] Duplicate `seq` within one conversation raises `IntegrityError`; the same `seq` in
      two different conversations is allowed.
- [ ] `tool_payload` round-trips a dict and accepts `None`.
- [ ] A second lead for one conversation raises `IntegrityError`.
- [ ] A duplicate `session_id` raises `IntegrityError`.
- [ ] **Inserting `'USER'` into `messages.role` raises `IntegrityError`** — SQLite does
      enforce the CHECK, so the `values_callable` trap is catchable in the fast suite
      rather than only against Neon.
- [ ] Deleting a conversation removes its messages and its lead (needs the pragma above).
- [ ] Every new column is portable enough that the SQLite suite still builds its tables —
      `Uuid`, `func.now()`, and a dialect-agnostic `JSON` for `tool_payload`.
- [ ] `uv run pytest` passes, with the existing 31 tests still green.

### Verified by hand against Neon (genuinely not coverable by SQLite)

- [ ] `budget_min` / `budget_max` round-trip a `Decimal` without precision loss. SQLite has
      no native Decimal — `pyproject.toml` already suppresses SQLAlchemy's warning about
      exactly this — so precision is only real on Postgres.
- [ ] The live DDL confirms what the models intend: `messages.role`'s CHECK reads
      `IN ('user', 'assistant', 'tool')`, and both FKs report `ON DELETE CASCADE`. The
      SQLite tests prove the *behaviour*; this proves the shipped Postgres schema matches.
- [ ] The commands used are recorded in `backend/README.md`, matching how the properties
      checks were documented. **There is no `psql` on this machine** — they go through
      `uv run python` + SQLAlchemy, not a psql session.

## Out of Scope

- Any code under `backend/app/agent/` — no Gemini client, no tools, no loop. Phase 2.
- `POST /chat`, `GET /leads`, `GET /properties`. `GET /properties` stays deferred to ship
  with the `search_properties` tool, as the properties retro recorded.
- Pydantic schemas in `app/schemas/` — nothing serializes these tables yet, and guessing
  the response shape before the endpoint exists would be inventing a contract.
- Auth on any future `/leads` view (an open question in the overview §10).
- Seed data for the new tables. Conversations are created by real chats, not fixtures.
- Query helpers in `app/db/queries.py` beyond what the tests need. The get-or-create by
  `session_id` and the lead upsert belong with the code that calls them.
- Any frontend change. The frontend still runs on `lib/properties.ts` and `lib/chat.ts`.

## Edge Cases

- **Several messages written in one transaction.** The agent loop appends a user turn, a
  tool turn, and an assistant turn inside one request. Postgres `now()` is
  transaction-start time, so all three share `created_at` and a random UUID `id` is not an
  insertion-order tiebreaker — this is the exact nondeterminism the seeded properties hit.
  `seq` is the ordering key; `created_at` is informational only.
- **A lead captured before a name or phone is known.** Every lead field except
  `conversation_id` is nullable, so a partial lead is a valid row. `capture_lead` fills it
  in over several turns; `updated_at` is what distinguishes a stale partial from a fresh one.
- **`capture_lead` called twice in one conversation.** The unique `conversation_id` makes
  the second call an update, not a duplicate row. Enforced by the constraint, not by
  trusting the model to only call it once.
- **A tool turn with no prose.** `content` defaults to `""` rather than being nullable, so
  a row is never both empty and null — `tool_payload` carries the meaning in that case.
- **Deleting a conversation.** Cascade removes its messages and lead. Nothing depends on
  orphaned messages surviving.

## Notes

- **Deliberate deviations from overview §4**, in the spirit of the `image_alt` precedent:
  - `messages.tool_payload` (JSON, nullable) — §4 lists only `content` text, which cannot
    faithfully replay a `function_call` / `function_response` pair back to Gemini.
  - `messages.seq` (int) — §4 implies `created_at` ordering, which does not hold within a
    single transaction. See Edge Cases.
  - `leads.updated_at` — `capture_lead` updates rows across turns, and §4's `created_at`
    alone can't show when detail was last added.
  - `session_id` and `leads.conversation_id` are UNIQUE — §4 says neither, but both follow
    from the overview §5 wording that `capture_lead` "writes/updates a row" for "the
    current `conversation_id`".
- `tool_payload` is plain dialect-agnostic `JSON`, not `JSONB`, because nothing queries
  inside it — it is read back wholesale to rebuild `contents`. Swapping to
  `JSONB().with_variant(JSON(), "sqlite")` later is a one-line migration if a query needs
  it, following the `ARRAY` precedent in `property.py`.
- Existing patterns to follow rather than reinvent: `app/db/base.py`'s naming convention
  (already in place, so the new CHECK and FK constraints get predictable names),
  `app/models/property.py` for column idiom, and `backend/tests/conftest.py` for the
  SQLite override.
- **Testability was measured before this chore started, not assumed.** Two things the
  properties retro implies are Postgres-only turned out to be reachable in the fast suite,
  and one thing that looks reachable is not:
  - SQLite **does** enforce CHECK constraints. The emitted DDL reads
    `CHECK (role IN ('user', 'assistant', 'tool'))` and inserting `'USER'` raises. The
    docstring in `tests/conftest.py` says the suite "deliberately does NOT cover... the
    enum CHECK constraints" — that is understated, and worth correcting while here.
  - SQLite **does not** enforce foreign keys without a per-connection
    `PRAGMA foreign_keys=ON`. This is the one that would have wasted debugging time.
  - `Numeric` fidelity is genuinely Postgres-only; SQLite has no native Decimal.
- **Deferred, not rejected: a real-Postgres test path.** Docker is available, so
  testcontainers could close the `Numeric` and native-DDL gap permanently instead of once
  per migration. This is the second migration in a row ending in "verify by hand against
  Neon," so the recurring cost is real — but a new dev dependency and a second test path
  is its own chore, best taken after Phase 2 lands.
