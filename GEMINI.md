# Property Advisor – Development Guidelines & Rules

## Project Context & Architecture

* **Project:** Property Advisor – A real estate brokerage platform for the Sri Lankan (Colombo-focused) market.
* **AI Persona:** Amaya (female, early twenties). The agent chats with buyers/renters to match properties and capture leads. Do not rename the brand or persona.
* **Current State:** The full public-facing stack and admin dashboard are live and connected. Observability (structured JSON logging via structlog) is active in production. Frontend is deployed on Vercel, backend on Render.
* **Core Constraint:** The agent uses a **hand-rolled tool-calling loop** against the raw Gemini API (`gemini-3.1-flash-lite`). **Do not use LangChain, LangGraph, or any agent frameworks.**

## Workflow & Efficiency Rules

* **Direct Implementation:** Implement features directly based on prompts; refer to `context/PROJECT_OVERVIEW.md` for existing data models and specifications.
* **Minimal Changes:** Only touch files necessary for the immediate task. Do not refactor unrelated code or add unspecced features.
* **No Filler:** Omit conversational filler, explanations of what you are about to do, or apologies. Output only the necessary code or direct, concise answers.
* **Git Hygiene:** Never commit without explicit permission. No "Generated with Claude" or co-authored attribution lines.

## Frontend (Next.js 16 + Tailwind v4)

* **Mobile-First Design:** This is a mobile-first application. When developing UI, the primary focus must be the mobile view. Ensure everything is presented properly on mobile before scaling up to larger screens.
* **Stack:** Next.js 16.2.12 (App Router), React 19.2.4, Tailwind v4, TypeScript, `pnpm` (run commands from `frontend/`).
* **Next.js 16:** Respect breaking changes in Next 16 App Router. Do not use Next 14/15 patterns from memory if they have been deprecated.
* **Tailwind v4:** Configured exclusively through `@theme` in `frontend/app/globals.css`. **Do not create or look for a `tailwind.config.ts`.**
* **Testing:** Vitest + React Testing Library (`pnpm test` from `frontend/`).
  * **Essential Only:** Test behavior, user interactions, and API contracts (`*-api.test.ts`, dialogs, drawers, form submissions).
  * **No Brittle UI Tests:** Do NOT write tests that assert CSS classes (e.g., `toHaveClass`), rigid DOM hierarchies, copy wording, or placeholder scaffold boundaries. Layout and visual styling are verified in-browser.
  * *Gotcha:* `jsdom` has no layout engine.
  * *Gotcha:* Auto-cleanup is explicitly handled in `tests/setup.ts`.

## Backend (FastAPI + uv + Neon/SQLite)

* **Stack:** FastAPI, Python 3.11, SQLAlchemy 2.0, Alembic, managed via `uv` and `pyproject.toml` (no `requirements.txt`). Run commands from `backend/`.
* **Execution:**
  * `uv sync`
  * `uv run fastapi dev app/main.py`
  * `uv run alembic upgrade head`
  * `uv run pytest`
* **Testing:** Pytest uses an in-memory SQLite database, while production uses Neon Postgres.
  * **Efficiency:** During rapid development, run scoped test files (e.g., `uv run pytest tests/test_agent_loop.py`) rather than the entire 255-test suite.
  * *Gotcha:* Models must stay portable across engines (e.g., use `Uuid`, `func.now()`, `ARRAY(Text).with_variant(JSON(), "sqlite")`).
  * *Gotcha:* `tests/conftest.py` sets `PRAGMA foreign_keys=ON`; without this, SQLite ignores foreign keys.
  * *Gotcha:* Alembic 1.19 has a false positive on enum columns, emitting `drop_constraint` for valid CHECKs. Ignore/filter these in migrations.

## Database Access & Safety Rules

* **Scope:** Only access the `property-advisor` database.
* **Environment:** You may access both development and production data.
* **CRITICAL SAFETY RULE:** **NEVER** edit or delete production data without explicit user confirmation. If you are attempting to delete or edit production data, you must ask the user repeatedly to confirm before proceeding.

## Deployment & Infrastructure (Render MCP)

* **Workspace:** `Hobby Projects` (`tea-d9d7ejrbc2fs73emal00`)
* **Service:** `property-advisor` (ID: `srv-da2as415efls73erss9g`, slug: `property-advisor-96sg`)
* **URL:** `https://property-advisor-96sg.onrender.com`
* **Root Dir:** `backend/`
* **Build Command:** `pip install uv && uv sync --frozen --no-dev && uv run alembic upgrade head`
* **Start Command:** `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
* **Render MCP:** Enabled via server `render`. Available tools include `list_services`, `get_service`, `list_deploys`, `trigger_deploy`, `list_logs`, `update_environment_variables`, and `get_metrics`.

