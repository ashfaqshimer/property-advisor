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

Always read a generated migration before applying it. In particular the two enum
columns must render as `VARCHAR` + named CHECK, not `postgresql.ENUM`.

## Tests

`uv run pytest` runs against in-memory SQLite with `get_db` overridden — no network, no
database. It does **not** exercise the real Postgres `ARRAY` type, the enum CHECK
constraints, or `Numeric` fidelity. Verify those against Neon directly:

```bash
uv run python -c "
from app.db.session import SessionLocal
from sqlalchemy import text
with SessionLocal() as s:
    print(s.execute(text('select property_type, count(*), array_length(image_urls,1) from properties group by 1,3')).all())
"
# [('apartment', 2, 1), ('house', 6, 1)]
```

## Deploying (Render)

Not yet done. When it is: build with `uv sync --frozen --no-dev`, start with
`uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and run
`uv run alembic upgrade head` as a pre-deploy command. Render's free tier spins down
when idle, so the first request after inactivity is slow — expected, not a bug.
