# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

**Frontend shell is complete; backend has its database layer and one endpoint.**

`frontend/` — Next **16.2.12**, React 19.2.4, Tailwind **v4**, TypeScript, pnpm. Every region of the homepage is built (header, hero, featured grid, chat panel, footer). It still runs entirely on local fixtures: `lib/properties.ts` and `lib/chat.ts`. Nothing fetches from the backend yet — there is no API client and `NEXT_PUBLIC_API_URL` is unset.

`backend/` — FastAPI on **uv + `pyproject.toml`** (not `requirements.txt`, which the spec mentions), Python 3.11. Has SQLAlchemy 2.0 + Alembic against Neon, all four tables (`properties`, `conversations`, `messages`, `leads`), and `GET /properties/featured` alongside `GET /health`. The agent (`app/agent/`), `POST /chat`, and `GET /properties` do not exist yet — Phase 2/3. Nothing writes to the three chat tables yet; they exist so the Phase 2 loop and `capture_lead` have somewhere to persist.

Backend commands run from `backend/`: `uv sync`, `uv run alembic upgrade head`, `uv run python -m app.db.seed`, `uv run fastapi dev app/main.py`, `uv run pytest`. See [backend/README.md](backend/README.md).

## Frontend: Next 16 + Tailwind 4

**This is not the Next.js in your training data.** Next 16 has breaking changes to APIs, conventions, and file structure. Before writing frontend code, read the relevant guide under `frontend/node_modules/next/dist/docs/` (`01-app/` for App Router) rather than working from memory, and heed deprecation notices.

Tailwind is **v4**, configured through `@theme` in `frontend/app/globals.css` via `@tailwindcss/postcss`. There is no `tailwind.config.ts` and one should not be added.

Package manager is **pnpm**, installed inside `frontend/` with no root workspace — the repo root has no `package.json`. Run `pnpm build` / `pnpm dev` from `frontend/`. pnpm 10 blocks postinstall scripts by default; `sharp` and `unrs-resolver` are listed under `ignoredBuiltDependencies` in `frontend/pnpm-workspace.yaml`.

## What this is

A real estate brokerage site for the Sri Lankan (Colombo-focused) market, built around an AI agent that chats with buyers/renters, matches them to properties in a live database, and captures leads. Monorepo: `/frontend` (Next.js App Router + TypeScript + Tailwind, Vercel) and `/backend` (FastAPI + SQLAlchemy/Alembic + Neon Postgres, Render).

The full spec — data models, endpoints, tool signatures, env vars, build phases — lives in [context/PROJECT_OVERVIEW.md](context/PROJECT_OVERVIEW.md). Read it before implementing anything; don't re-derive design decisions that are already settled there.

## Branding

The brand is **Property Advisor** — everywhere. It was renamed from "Home Advisor" (see `context/chores/done/brand-rename/spec.md`): the old name collided with HomeAdvisor.com, Angi's US home-services marketplace, on search and trademark, and "Home" excluded bare land, which is in scope. Scope is **land, homes, and apartments** — vehicles were considered as a future category and explicitly dropped, which is what settled "Property" as the umbrella term. Don't reopen the naming question.

The AI assistant is a separate persona: **Amaya**, female, early twenties, she/her, an advisor *at* Property Advisor. Don't rename her to the brand; the persona is settled in `context/features/done/agent-core/spec.md`. The split is load-bearing in the UI — the navbar and footer carry the brand, while the chat panel names Amaya ("Amaya — AI Advisor", `SPEAKER_LABELS.agent`, and both of the panel's `aria-label`s). Distinctiveness lives in the persona, which is why a plainly descriptive brand name is fine.

`context/ui-interface.png` is a visual reference for layout, spacing, and colour only; its "Terra & Co." / "Terra AI Agent" wording is placeholder art and must never be copied into the codebase. Same goes for the mockup's property listings, prices, and contact details — illustrative, not real content. Don't ask about this again.

## Architectural constraint (the point of the project)

The agent uses a **hand-rolled tool-calling loop against the raw Gemini API — no LangChain, no LangGraph, no agent framework.** This is deliberate: demonstrating manual orchestration is a primary goal, not an implementation detail. Do not introduce an agent framework as a "simplification." A LangGraph migration is explicitly deferred to a documented v2.

The loop lives in `backend/app/agent/loop.py`: append user message → send full contents + tool declarations + system instruction to Gemini → if a `function_call` part comes back, execute the Python function and append the model turn plus a `function_response` part → repeat until a plain text response → persist and return. Cap the iterations (~5) so a model that keeps re-calling a tool can't spin.

Model: `gemini-3.1-flash-lite` via AI Studio, using the `google-genai` Python SDK (`GEMINI_API_KEY`). It's the cheapest tier in its generation; if it proves unreliable at chaining `search_properties` → `capture_lead` across one conversation, the non-lite Flash model of the same generation is a drop-in upgrade (model string only). Don't silently swap the model to work around a prompt bug — fix the prompt first. Keep the model string in one place (config/settings), not inlined at the call site.

Agent tools (`backend/app/agent/tools.py`): `search_properties`, `capture_lead`, and optionally `get_property_details`. Persona and behavior rules (ask clarifying questions before searching; work toward name/phone naturally rather than demanding it upfront) belong in `backend/app/agent/prompts.py`, not scattered through the loop.

## Feature workflow (skills)

Work is tracked through four skills that form an ordered pipeline. Follow it rather than jumping straight to code:

1. `draft-spec` — writes `context/features/<slug>/spec.md` (or `context/chores/<slug>/spec.md`). Always first for new work.
2. `load-feature` — copies that spec into the Active Feature section of the tracker. No branching, no code.
3. `start-feature` — creates `feature/<slug>` or `chore/<slug>`, flips status to In progress, commits the tracker update alone.
4. `complete-feature` — verifies acceptance criteria against the actual codebase, runs tests, and **only then** archives. Gaps mean report-and-leave-active, never archive-and-fix-later.

All four skills live in [.claude/skills/](.claude/skills/). The tracker they read and write is [context/current-feature.md](context/current-feature.md) — dynamic state (what's in progress, what just shipped), deliberately kept separate from this file, which holds static project facts.

## Working rules (from context/ai-interaction.md)

- **Never commit without explicit permission**, and never before `pnpm build` and `pnpm test` pass (from `frontend/`). Fix errors first.
- Conventional commit messages (`feat:`, `fix:`, `chore:`). **No "Generated with Claude" or "Co-Authored-By" lines** — this repo explicitly opts out.
- One branch per feature/fix; ask before deleting a branch after merge.
- Make minimal changes. Don't refactor unrelated code, don't add unspecced features, don't delete files without asking.
- If something isn't working after 2-3 attempts, stop and explain rather than trying more random fixes.

## Frontend testing

Vitest + React Testing Library in `frontend/tests/`, run with `pnpm test` (`test:watch`, `test:coverage`). Config is `vitest.config.mts` — `.mts` deliberately, so Vite loads it as ESM instead of warning about CJS.

**jsdom has no layout engine and does not apply Tailwind.** It cannot verify sticky positioning, column counts, responsive breakpoints, or overflow. Tests here cover DOM structure, landmarks, and scope boundaries (no images/links/headings in a shell that's meant to stay content-free); anything visual is still verified in a browser. Where a test asserts a Tailwind class, that's a regression guard against accidental deletion — it does not prove the layout works, and should say so in a comment.

Testing Library's auto-cleanup only registers when Vitest globals are enabled. They aren't, so `tests/setup.ts` calls `afterEach(cleanup)` explicitly. Without it the DOM accumulates across tests in a file and queries start matching duplicates.

## Backend testing

pytest in `backend/tests/`, run with `uv run pytest`. There's no `[build-system]`, so `app` isn't installed as a package — `pythonpath = ["."]` in `pyproject.toml` is what puts `backend/` on `sys.path`.

**Tests run against in-memory SQLite with `get_db` overridden, not Postgres.** No network, sub-second. This works only because the models use `Uuid`, `func.now()`, `ARRAY(Text).with_variant(JSON(), "sqlite")`, and a dialect-agnostic `JSON` — keep new columns portable or the suite stops building its tables.

SQLite covers more than it looks like it does: it enforces UNIQUE, it enforces CHECK constraints (so the enum `values_callable` trap is catchable there), and it enforces foreign keys because `tests/conftest.py` sets `PRAGMA foreign_keys=ON` — **without that pragma SQLite ignores foreign keys entirely**, and a cascade test fails looking like a broken model. It does **not** cover the real Postgres `ARRAY` type, `Numeric` Decimal fidelity, or whether the shipped DDL matches the models; verify those against Neon by hand (commands in [backend/README.md](backend/README.md), which go through `uv run python` — there is no `psql` here).

**Autogenerate has a standing false positive on enum columns.** Alembic 1.19 reflects CHECK constraints but excludes the `_type_bound` ones `Enum(native_enum=False)` creates, so it emits `drop_constraint` for CHECKs that are present and correct. `alembic/env.py` filters them by name via `include_object`. If a migration ever wants to drop a `ck_*` backing an enum, that's this bug — don't apply it.

`tests/conftest.py` sets a placeholder `DATABASE_URL` **before** importing anything under `app.`, because `app/db/session.py` builds its engine at module scope and `Settings.database_url` has no default. `create_engine()` doesn't connect, so the placeholder is never dialled.

## Environment

Backend `.env`: `DATABASE_URL` (Neon), `GEMINI_API_KEY` (AI Studio), `ALLOWED_ORIGINS`.
Frontend `.env.local`: `NEXT_PUBLIC_API_URL` (the Render backend URL).

The Render free tier spins down when idle, so the first request after inactivity is slow — expected, not a bug.
