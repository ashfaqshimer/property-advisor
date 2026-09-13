# Property Advisor – Development Guidelines & Rules

## Project Context & Architecture

* **Project:** Property Advisor – A real estate brokerage platform for the Sri Lankan (Colombo-focused) market.
* **AI Persona:** Amaya (female, early twenties). The agent chats with buyers/renters to match properties and capture leads. Do not rename the brand or persona.
* **Current State:** Frontend shell is complete using local fixtures. Backend (Render) has DB layer and agent loop, but the API endpoints (`POST /chat`, `GET /properties`) are not yet wired.
* **Core Constraint:** The agent uses a **hand-rolled tool-calling loop** against the raw Gemini API (`gemini-3.1-flash-lite`). **Do not use LangChain, LangGraph, or any agent frameworks.**

## Workflow & Efficiency Rules

* **Direct Implementation:** Implement features directly based on prompts; refer to `context/PROJECT_OVERVIEW.md` for existing data models and specifications.
* **Minimal Changes:** Only touch files necessary for the immediate task. Do not refactor unrelated code or add unspecced features.
* **No Filler:** Omit conversational filler, explanations of what you are about to do, or apologies. Output only the necessary code or direct, concise answers.
* **Git Hygiene:** Never commit without explicit permission. No "Generated with Claude" or co-authored attribution lines.

## Frontend (Next.js 16 + Tailwind v4)

* **Stack:** Next.js 16.2.12 (App Router), React 19.2.4, Tailwind v4, TypeScript, `pnpm` (run commands from `frontend/`).
* **Next.js 16:** Respect breaking changes in Next 16 App Router. Do not use Next 14/15 patterns from memory if they have been deprecated.
* **Tailwind v4:** Configured exclusively through `@theme` in `frontend/app/globals.css`. **Do not create or look for a `tailwind.config.ts`.**
* **Testing:** Vitest + React Testing Library (`pnpm test` from `frontend/`).
  * *Gotcha:* `jsdom` has no layout engine. Tests verify DOM structure and scope boundaries, not visual styling.
  * *Gotcha:* Auto-cleanup is explicitly handled in `tests/setup.ts`.

## Backend (FastAPI + uv + Neon/SQLite)

* **Stack:** FastAPI, Python 3.11, SQLAlchemy 2.0, Alembic, managed via `uv` and `pyproject.toml` (no `requirements.txt`). Run commands from `backend/`.
* **Execution:**
  * `uv sync`
  * `uv run fastapi dev app/main.py`
  * `uv run alembic upgrade head`
  * `uv run pytest`
* **Testing:** Pytest uses an in-memory SQLite database, while production uses Neon Postgres.
  * *Gotcha:* Models must stay portable across engines (e.g., use `Uuid`, `func.now()`, `ARRAY(Text).with_variant(JSON(), "sqlite")`).
  * *Gotcha:* `tests/conftest.py` sets `PRAGMA foreign_keys=ON`; without this, SQLite ignores foreign keys.
  * *Gotcha:* Alembic 1.19 has a false positive on enum columns, emitting `drop_constraint` for valid CHECKs. Ignore/filter these in migrations.
