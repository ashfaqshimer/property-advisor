# Spec: Backend Properties API

## Goal

Stand up the database layer the whole backend has been waiting on: a `properties`
table on Neon Postgres, migrated with Alembic, seeded with the eight listings the
homepage already renders, and readable over HTTP at `GET /properties/featured`.

This is Phase 1 of [PROJECT_OVERVIEW.md](../../PROJECT_OVERVIEW.md) §9, scoped
deliberately narrow — **one table, one endpoint, backend only.** It exists to prove
data flows out of a real database before any agent or frontend work depends on it.

## Acceptance Criteria

**Database & migration**

- [ ] `uv run alembic upgrade head` creates a `properties` table on Neon from a clean
      database, and `uv run alembic current` reports `(head)`.
- [ ] `uv run alembic downgrade base && uv run alembic upgrade head` succeeds — the
      migration reverses cleanly.
- [ ] `alembic/env.py` reads the connection string from `app.config`, not from
      `alembic.ini` (`sqlalchemy.url` in the ini is empty).
- [ ] The table has every column from PROJECT_OVERVIEW §4 — `id`, `title`,
      `description`, `price`, `location`, `property_type`, `bedrooms`, `bathrooms`,
      `sqft`, `image_urls`, `status`, `created_at` — plus `image_alt` (see Notes).
- [ ] `property_type` and `status` are `VARCHAR` + named CHECK constraints, not native
      Postgres `ENUM`, and store lowercase values (`house`, not `HOUSE`).
- [ ] Inserting a row with `property_type = 'castle'` is rejected by the database.

**Seed**

- [ ] `uv run python -m app.db.seed` inserts 8 properties matching
      [frontend/lib/properties.ts](../../../frontend/lib/properties.ts) — same titles,
      locations, descriptions, bed/bath/sqft counts, image URLs, and alt text.
- [ ] Running the seed a second time leaves exactly 8 rows — no duplicates.
- [ ] `"LKR 185M"` in the fixture becomes `price = 185000000` in the database.

**Endpoint**

- [ ] `GET /properties/featured` returns 200 with a JSON array of 8 objects.
- [ ] `GET /properties/featured?limit=3` returns exactly 3.
- [ ] `limit=0` and `limit=99` are rejected with 422 (bounded `ge=1, le=24`).
- [ ] Properties with `status` of `sold` or `under_offer` are excluded.
- [ ] Results are ordered newest-first and land in the same order as the homepage grid.
- [ ] `price` serializes as a JSON **number** (`185000000.0`), not a string, and each
      object carries `"currency": "LKR"`.
- [ ] Field names on the wire are snake_case, matching the columns.
- [ ] `GET /health` still returns `{"status": "ok"}`.
- [ ] A preflight `OPTIONS` request from `http://localhost:3000` comes back with a
      matching `access-control-allow-origin` header.

**Config & tests**

- [ ] `backend/.env.example` exists, is tracked by git (`git check-ignore` exits 1),
      and documents `DATABASE_URL`, `ALLOWED_ORIGINS`, and `GEMINI_API_KEY`.
- [ ] `uv run pytest` passes with no network access and no real database.
- [ ] `backend/README.md` documents setup, migration, seed, run, and test commands.

## Out of Scope

- **Any frontend change.** `PropertyGrid` keeps importing `lib/properties.ts`. Wiring
  it up needs a price formatter, `next.config.ts` image hosts, `NEXT_PUBLIC_API_URL`,
  and test updates — that is its own spec.
- **`GET /properties` with filters.** Listed in PROJECT_OVERVIEW §6, deferred: its
  filter logic is the Phase 2 `search_properties` tool's filter logic, and building it
  in two places invites drift. It lands with the agent.
- **`leads`, `conversations`, `messages` tables.** They arrive in Phase 2/3 where
  their shape gets exercised.
- **Anything Gemini.** `GEMINI_API_KEY` and `gemini_model` are declared in settings so
  the model string has one home, but nothing reads them.
- **`GET /leads`**, auth, and rate limiting.
- **Deployment to Render.** The README notes the build/start commands; it isn't done.
- **A `featured` boolean column** — see Notes.
- **A `slug` column.** Deferred until detail pages exist. The seed's deterministic
  `uuid5(namespace, slug)` ids make backfilling one trivial.

## Edge Cases

- **Empty table** — `/properties/featured` returns `[]` with 200, not a 404.
- **`limit` greater than the row count** — returns whatever exists, no error.
- **Neon idle suspend** — the free tier suspends compute; the engine uses
  `pool_pre_ping=True` so the first request after a suspend reconnects instead of
  throwing a stale `OperationalError`.
- **Identical `created_at` across seeded rows** — Postgres `now()` returns
  *transaction start* time, so all 8 rows inserted in one commit would share a
  timestamp and "newest first" would be nondeterministic. The seed staggers
  `created_at` explicitly, and the query adds `id` as a tiebreaker.
- **Nullable `bedrooms` / `bathrooms` / `sqft`** — land and commercial listings have
  none. They serialize as `null`, and the frontend will have to handle that when it
  wires up.
- **Missing `DATABASE_URL`** — settings has no default, so the app fails loudly at
  import rather than silently connecting nowhere.

## Notes

**Deliberate deviations from PROJECT_OVERVIEW.md**, each with its reason:

1. **`image_alt` column added** (§4 doesn't have it). Alt text describes the
   photograph, not the listing, so it can't be derived from `title` — and
   `frontend/tests/property-grid.test.tsx` asserts exactly that
   (`not.toHaveAccessibleName(sample.title)`). Without the column the eventual
   frontend swap either drops alt text or fails that test.
2. **`currency` lives on the response schema, not the table** — a `Literal["LKR"]`
   constant. The database stays single-currency per spec; the contract stays explicit
   in `/docs` instead of being buried in a frontend formatter.
3. **Enums as `VARCHAR` + CHECK, not native PG `ENUM`.** Adding a member later is an
   ordinary migration rather than an `ALTER TYPE` that can't run alongside its own
   usage, and the Phase 2 tool can compare raw model output uncast.
4. **"Featured" means "newest available, limit 8"** — no `featured` column. With eight
   listings a boolean would be true on every row and encode nothing. It becomes a real
   editorial decision, and earns a column, when the catalogue outgrows the grid.
5. **uv + `pyproject.toml`, not `requirements.txt`** (§3). Already true as of `b21abd5`;
   the lockfile is the better reproducibility story. Render uses `uv sync --frozen`.

**Stack:** sync SQLAlchemy 2.0 + psycopg3, not async. The Phase 2 Gemini loop is
sequential and blocking; an async endpoint would end up threadpooling it anyway, and
async SQLAlchemy under a threadpooled blocking loop is the worst of both. psycopg3
specifically because it is the same driver in both modes, so going async later changes
`create_engine` and nothing else.

**Known blocker:** `.gitignore:33` (`.env*`, added by the `.vercel` commit `c639130`)
shadows the `!.env.example` negation on line 7 — last match wins. Verified with
`git check-ignore -v backend/.env.example`. Line 33 must be deleted or `.env.example`
never lands in git.

**Testing approach:** in-memory SQLite plus `app.dependency_overrides[get_db]` — no
network, sub-second. This works only because of the `Uuid`, `func.now()`, and
`ARRAY(Text).with_variant(JSON(), "sqlite")` choices in the model. It honestly does
*not* cover the real `ARRAY` type or `Numeric` fidelity; those are verified manually
against Neon.

Full implementation plan, including code sketches and the end-to-end verification
commands: `~/.claude/plans/lets-work-on-getting-dreamy-wigderson.md`.
