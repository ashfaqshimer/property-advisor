<!--
  HOW TO USE THIS FILE
  =====================
  Purpose: Give Claude Code fast orientation on "what am I working on right now
  and why" without re-explaining context every session.

  Workflow:
  1. Reference this file at the start of a session, e.g.
     "Read context/current-feature.md before we start."
  2. Update the "Active Feature" section as you go — treat it like a
     scratchpad, not a formal doc. Messy but current beats tidy but stale.
  3. When a feature ships, cut its "Active Feature" block, compress it into
     a 3-5 line entry, and paste it at the TOP of "Feature History".
  4. Keep this file separate from CLAUDE.md:
       - CLAUDE.md   = static project facts (stack, conventions, commands)
       - THIS FILE   = dynamic state (what's in progress, what just happened)

  CONTEXT BUDGET WARNING:
  Feature History grows forever if you let it. Once it passes ~15-20 entries,
  archive the oldest ones into a separate ARCHIVE.md (or history/2026-Q1.md)
  and just keep a one-line pointer here. Claude Code doesn't need the full
  history every session — only the recent, relevant thread.
-->

# Current Feature Tracker

<!-- Optional: link back to the main context doc so Claude Code can hop over if needed -->
> See also: `CLAUDE.md` for stack, conventions, and project-wide rules.

---

## 🔨 Active Feature

<!--
  Fill this in fresh for whatever you're currently building.
  Keep it honest and current — if something below is wrong, fix it don't
  just append a correction under it.
-->

**Feature:** <!-- e.g. "Property search filters (price range, bedrooms, location)" -->

**Spec:** <!-- context/features/<slug>/spec.md -->

**Goal:**
<!-- One or two sentences. What does "done" look like from the user's POV? -->

**Status:** `Not started | In progress | Blocked | In review/testing | Done`

**Branch:** <!-- e.g. feature/property-search-filters -->

### Approach / Key Decisions
<!--
  Why you're building it this way — especially anything non-obvious.
  This is the highest-value section: code shows WHAT, this shows WHY.
-->
-

### Files Touched
<!-- Running list so Claude Code doesn't have to grep the whole repo to find scope -->
-

### Open Questions / Blockers
<!-- Anything unresolved. Delete once resolved, don't let these pile up stale. -->
-

### Next Steps
<!-- Ordered, small, actionable. This is what Claude Code should tackle first. -->
1.
2.
3.

### Explicitly Out of Scope (for now)
<!-- Prevents Claude Code from "helpfully" expanding scope mid-task. -->
-

---

## 📜 Feature History

<!--
  Append-only, most recent first. Each entry should be short — 3-5 lines max.
  Goal is "remind me what this was and where the bodies are buried," not a
  full changelog (git already has that).
-->

### Chat client — `ChatPanel` wired to `POST /chat` — 2026-08-19
- **What:** The panel is real. `lib/api.ts` (new) sends a turn and classifies every failure;
  `ChatPanel` is a client component with an optimistic append, a pending state, a recoverable
  failure, and a per-page-load `session_id` that is never stored. `SEED_CONVERSATION` is gone.
  Amaya now opens with a `GREETING` constant that `run_turn` persists as `seq 0`. Live on
  Vercel + Render; a deployed multi-turn conversation wrote a real `leads` row.
- **Key files:** `frontend/lib/api.ts`, `frontend/components/chat/ChatPanel.tsx`,
  `frontend/lib/chat.ts`, `backend/app/agent/{prompts,loop}.py`,
  `frontend/tests/{chat-api,chat-panel}.test.tsx`
- **Gotchas/lessons:**
  - **A trailing slash in `ALLOWED_ORIGINS` breaks CORS and the error tells you nothing.**
    Starlette matches `allow_origins` by exact string, and an `Origin` header is only ever
    `scheme://host[:port]` — never a path, never a slash. So `https://…vercel.app/` permits an
    origin no browser can send. **Diagnose by sending the preflight both ways:** bare origin
    gave 400 with *no* `access-control-allow-origin`, with-slash gave 200 echoing `…app/`.
    That's a 10-second check that beats reading middleware config. Setting it also silently
    dropped `http://localhost:3000` — a replace, not an append.
  - **jsdom implements no implicit form submission**, verified directly rather than assumed, so
    no dispatched Enter key can test "Enter sends". The panel tests assert the *structure*
    (input in a form, real submit button) and say so; Enter itself was proven over CDP. A test
    that dispatched keydown and passed would have proven nothing.
  - **The timeout is 60s, not the spec'd 45s.** Measuring the deployed backend found warm turns
    of 3.2s, 16.4s and **30.4s** — the slowest being one that called `search_properties`, so two
    model calls. Cold start plus a turn like that clears 45s. The spec's ceiling came from
    adding a cold start to a *fast* turn; the tail is what matters. Same measurement retired a
    "this can take up to half a minute" pending message that the data contradicted.
  - **The duplicated greeting is guarded by a test that reads across the monorepo.** The spec
    asked for cross-referencing comments; comments don't fail builds, so
    `test_agent_prompts.py` opens `frontend/lib/chat.ts` and asserts the strings match. No
    assertion living inside one stack can catch two copies drifting apart.
  - **Inserting the greeting shifted seven existing `seq` assertions** in `test_agent_loop.py`
    (`[0,1]`→`[0,1,2]`, `rows[1],rows[2]`→`rows[2],rows[3]`). Expect this whenever anything is
    added to the front of a conversation; they were updated, not loosened.
  - **`grep -rn x dir --include=*.tsx` silently fails under zsh** — the shell expands the glob,
    grep errors, and "no matches found" reads exactly like a verified absence. Three criteria
    were briefly marked ✅ on that basis. **Quote the pattern**, and treat a negative grep as
    suspect until it prints something.
  - **A CORS error was the only available proof the frontend had deployed.** Vercel's team URLs
    sit behind SSO and the GitHub deployments API lagged a day, but the old panel had no API
    client and every control `disabled`, so a cross-origin POST could only be new code.
  - **Two `*.vercel.app` domains guessed from the project name belonged to strangers**, both
    answering 200 with unrelated titles. Those subdomains are globally unique; grep the page
    for a project-specific marker before believing a plausible name.
  - **CDP: `Page.captureScreenshot` clips are page-relative, not viewport-relative.** The panel
    extends past the fold, so the first screenshots came back half blank — add `window.scrollX/Y`
    and `captureBeyondViewport: true`. Also, a cross-origin POST shows up as **two**
    `requestWillBeSent` events (preflight `OPTIONS` + `POST`), which reads as a double-submit
    until you filter on method.
  - Remaining uncovered lines in `ChatPanel.tsx` (184-194, 215) are defensive guards the real
    paths can't reach: a non-`ChatError` escaping the client, and a retry guard on a button that
    only renders when there is something to retry.

### `POST /chat` — HTTP surface for the agent loop — 2026-08-19
- **What:** Thin endpoint over `loop.run_turn` — schemas, a `get_agent_client` dependency,
  and error mapping (422 validation / 502 `APIError` / 503 missing key), plus a one-retry
  guard for the UNIQUE `session_id` race. No agent behaviour changed. Verified in
  production: clarifying question → `search_properties` → prose → `capture_lead` writing a
  real `leads` row.
- **Key files:** `backend/app/api/chat.py`, `backend/app/schemas/chat.py`,
  `backend/tests/test_chat_endpoint.py`
- **Gotchas/lessons:**
  - **`GeminiNotConfigured` needs an app-level handler, not a try/except.** The client is
    built in a dependency, which resolves *before* the route function runs — a handler in
    the endpoint body never sees it.
  - **A safety block is not an exception.** It arrives as a candidate-less response, so it
    becomes a 200 carrying `FALLBACK_REPLY`, same as exhausting `MAX_TOOL_ITERATIONS`. The
    spec originally called it a 502 and had to be amended.
  - **`str_strip_whitespace=True` strips *before* length constraints run**, which is what
    makes `"   "` a `string_too_short` 422 instead of an empty string reaching the loop.
    Verified rather than assumed.
  - **A test asserting "nothing persisted" passed for the wrong reason at first.** The
    suite overrides `get_db` with `lambda: seeded` — not a generator — so FastAPI never
    closes it and flushed-but-uncommitted rows stay visible in the open transaction.
    Production's `get_db` closes and rolls back. The test now calls `seeded.rollback()` to
    stand in for that; without it the assertion is meaningless.
  - **`gemini-3.1-flash-lite` does chain `search_properties` → `capture_lead`** across one
    conversation, first try. CLAUDE.md flags the non-lite Flash as the upgrade if it
    didn't; it isn't needed.
  - **Render cold start measured at ~22s** on `/health` alone; add 4–8s of model time per
    turn. The `chat-client` spec needs to design its timeout and pending state around that.
  - **The Galle no-match path got verified by accident** and is worth keeping in mind: the
    one Galle house is LKR 130M, so a 120M ceiling legitimately returns zero, and the
    `guidance` payload correctly stopped the model denying coverage.

### Brand rename: Home Advisor → Property Advisor — 2026-08-19
- **What:** Renamed the brokerage everywhere (UI, system prompt, metadata, docs, and
  GitHub/Neon/Vercel), and landed the deferred relabel so the chat panel names **Amaya**
  rather than the brand. Scope settled as land/homes/apartments; vehicles considered and
  dropped, which is what made "Property" the right umbrella term.
- **Key files:** `frontend/components/layout/Logo.tsx`, `frontend/components/chat/ChatPanel.tsx`,
  `frontend/lib/chat.ts`, `backend/app/agent/prompts.py`, `CLAUDE.md`
- **Gotchas/lessons:**
  - **Two occurrences no brand-name grep can find.** `pyproject.toml`'s `description`
    field, and a bare `"H"` assertion in `footer.test.tsx` checking the logo glyph. The
    test caught the second one; the first only surfaced on a final sweep of *every* file
    rather than a search for the old name. On a rename, grep the artefacts, not the string.
  - **Two "zero match" acceptance criteria were unmeetable as written.** A test asserting
    the old brand is absent from `SYSTEM_PROMPT` must contain that string. Criterion was
    amended with the exception documented rather than dropping the guard — the prompt is
    the one surface where a stale name reaches users with no rendered output to catch it.
  - **Neon: the connection string already carried the database name.** `DATABASE_URL` has
    the role (`neondb_owner`) and database (`/neondb`) embedded, so a "rename the database
    too" plan was dropped after inspection — invisible to users, pure risk. Renaming the
    Neon *project* is cosmetic and leaves the connection string untouched, because the host
    derives from the endpoint ID.
  - **Archived specs were annotated, not rewritten.** Three shipped specs under
    `context/features/done/` assert copy that is now stale. Rewriting them would falsify
    what was agreed at the time, so each got a "superseded copy" header note instead.
  - Vercel's OIDC warning on project rename is a non-issue here: the `sub` claim embeds the
    project name, but nothing uses OIDC federation. Also note the project name and the
    `.vercel.app` domain are separate settings — renaming one does not re-point the other.

### Agent Core — the hand-rolled Gemini loop — 2026-08-18
- **What:** Phase 2. `loop.run_turn(db, session_id, message)` → history + tool declarations
  to Gemini, execute `search_properties` / `capture_lead`, persist every turn, return
  Amaya's reply. Raw `google-genai`, no framework, capped at 5 model calls. Plus a
  `leads.intent` enum and a terminal REPL. No endpoint — `POST /chat` is Phase 3.
- **Key files:** `backend/app/agent/` (`loop.py`, `tools.py`, `prompts.py`, `client.py`),
  `backend/app/db/queries.py`, `backend/scripts/chat.py`,
  `backend/alembic/versions/20260818_c9432564c721_add_leads_intent.py`
- **Gotchas/lessons:**
  - **The assistant is Amaya, not "Home Advisor".** Female, early twenties, an advisor *at*
    the brokerage. This amended the CLAUDE.md branding line, which had said the agent was
    named after the brand. Her age is load-bearing, not flavour: it's why she claims no
    experience and pushes valuations, commissions, and timelines to a senior agent, so the
    persona and the no-overclaiming rules hold each other up. The frontend labelled her
    with the brand name in 6 code sites and 5 test assertions; that was resolved by the
    `brand-rename` chore, which also renamed the brokerage to **Property Advisor**.
  - **A tool's payload argues with the prompt, and tends to win.** `search_properties`
    returning a bare `[]` invites "no results found" no matter what the system instruction
    says, and the failure is silent. The zero-match payload therefore carries its own
    `guidance` string. Belt-and-braces like this is worth it wherever a prompt rule fires
    exactly when a tool returns nothing.
  - **The `op.add_column` enum-CHECK worry did not hold.** Unlike the two prior migrations,
    where CHECKs rode inside `CREATE TABLE`, this one adds an enum column to an existing
    table — and Alembic 1.19 emits the constraint anyway. Confirmed in `pg_constraint`,
    confirmed it rejects `'banana'`, and confirmed `downgrade` drops column/CHECK/index with
    re-upgrade restoring all three. `_type_bound_check_names()` absorbed the new name by
    itself (it reads the models), so the follow-up autogenerate came back empty. **Still
    check the catalog rather than the column if this is repeated.**
  - **A mocked Gemini proves plumbing and nothing else** — the fake supplies the reply text,
    so no test here says anything about prompt adherence. That split is now explicit: the
    automated half asserts the tool contract, the model-behaviour half is five manual live
    scenarios. All five pass; `flash-lite` chained `search_properties` → `capture_lead` in
    one conversation and extracted four search params from one sentence, so no model upgrade
    was needed.
  - **The prompt's contact-details rule took three passes, and the second was worse than the
    first.** Live testing caught her re-asking for a number in disguise after being
    declined; a flat "never ask again" then contradicted the owner's own empty-inventory
    instruction, which *is* a second ask. Settled: one hedged re-offer when nothing
    published matches. **When a prompt rule won't hold after two attempts, check the brief
    for a conflict before tuning a third time.**
  - **Two acceptance criteria were written as greps that produce false positives** — the
    framework names appear in comments saying we don't use one, and `terra` matches
    "terrace" in real listing copy. Both criteria were reworded rather than waved through.
    Write criteria as *imports and dependencies* or word-boundary matches, not substrings.
  - `scripts/chat.py` defaults to in-memory SQLite, not Neon: every turn writes to three
    tables, and browsing against production leaves fake leads indistinguishable from real
    ones. `--neon` exists and is the one path deliberately never run here.
  - `pytest-cov` is now a dev dependency; the properties retro's "94%" had been measured
    ad hoc. Agent coverage is 99% — the single uncovered line is the live
    `generate_content` call, which by definition can't run offline.
  - **Deliberate deviations:** `leads.intent` and its `capture_lead` param (not in
    PROJECT_OVERVIEW §4/§5); filtered search moved *into* `db/queries.py`, reversing that
    module's own docstring, so Phase 3's `GET /properties` needn't import from `app.agent`;
    `scripts/` is new; the opening greeting was deferred to Phase 4 with its
    double-greeting trap written into the archived spec.

### Chat Schema (conversations, messages, leads) — 2026-08-17
- **What:** The last three tables from PROJECT_OVERVIEW §4, split out of Phase 2 so
  `capture_lead` and the agent loop have somewhere to write. Models + one migration + 17
  tests; no agent code, no endpoints. Neon is migrated to `388fdda07622`.
- **Key files:** `backend/app/models/` (`conversation.py`, `message.py`, `lead.py`,
  `_enum.py`), `backend/alembic/versions/20260817_388fdda07622_create_chat_tables.py`,
  `backend/tests/test_chat_models.py`, `backend/alembic/env.py`
- **Gotchas/lessons:**
  - **Autogenerate wanted to drop the `properties` CHECK constraints** — constraints that
    are present and correct. Alembic 1.19 reflects CHECKs from the database but excludes
    the `_type_bound` ones that `Enum(native_enum=False, create_constraint=True)` attaches,
    so the DB permanently looks ahead of the models. Silently destructive: dropping the
    CHECK is what would let an invalid enum value in. Fixed with an `include_object` filter
    in `env.py`, matching **by name** — for a *removed* constraint the object handed in is
    the reflected one and carries no `_type_bound` flag, so the obvious first attempt
    (testing the flag) compiled, ran, and did nothing. **Expect this on every future
    autogenerate that touches an enum column.**
  - **SQLite covers more than the properties retro claimed.** It enforces CHECK constraints
    — the emitted DDL really is `IN ('user', 'assistant', 'tool')` — so the
    `values_callable` trap is catchable in the fast suite, not just against Neon. Two
    criteria moved out of hand-verification because of this. `conftest.py`'s docstring was
    corrected; it had understated coverage.
  - **SQLite silently ignores foreign keys without `PRAGMA foreign_keys=ON`, per
    connection.** A cascade test written before that pragma fails looking like a broken
    model. Verified load-bearing by commenting it out — both cascade tests fail. Relationships
    use `passive_deletes=True` so the delete is the database's job, not SQLAlchemy's.
  - **`seq`, not `created_at`, orders a conversation.** One pass of the agent loop writes
    several turns in one transaction; Postgres `now()` is transaction-start time, so they
    share a timestamp, and the random UUID `id` is no tiebreaker. Same trap as the seeded
    properties, worse consequence — it replays a scrambled conversation to the model. The
    test documenting this passes on SQLite for a *different* reason (statement-time,
    one-second resolution), and says so, so nobody reads it as proof of the Postgres case.
  - Testability was measured *before* the branch existed rather than assumed, which is what
    surfaced the pragma and the CHECK findings and reshaped the spec. Worth repeating.
  - **Deliberate spec deviations:** `messages.tool_payload` (JSON, nullable — `content` text
    can't replay a `function_call`/`function_response` pair); `messages.seq`;
    `leads.updated_at`; and UNIQUE on both `conversations.session_id` and
    `leads.conversation_id`, which is what makes a repeat `capture_lead` an update rather
    than a duplicate row.
  - No `psql` on this machine — Neon verification goes through `uv run python` +
    SQLAlchemy. Both README snippets were run verbatim before being committed.
  - **Deferred, not rejected:** a real-Postgres test path via testcontainers (Docker is
    available). Two migrations running have now ended in "verify by hand against Neon", so
    the recurring cost is real. Best taken after Phase 2, since it's tooling.

### Backend Properties API — 2026-08-09
- **What:** Phase 1 of the backend. `properties` table on Neon (SQLAlchemy 2.0 +
  Alembic), seeded 1:1 from the frontend fixture, served at
  `GET /properties/featured`. Sync SQLAlchemy + psycopg3, not async — the Phase 2
  Gemini loop is sequential and blocking, and psycopg3 is the same driver either way.
  Frontend untouched; it still renders from `lib/properties.ts`.
- **Key files:** `backend/app/models/property.py`, `backend/app/db/` (session,
  queries, seed_data, seed), `backend/app/api/properties.py`,
  `backend/alembic/versions/20260809_da5c830b686e_create_properties_table.py`
- **Gotchas/lessons:**
  - **`SAEnum` persists the member NAME without `values_callable`.** The column would
    hold `"HOUSE"` and every lowercase filter would silently match nothing — silently,
    because it's a valid query returning zero rows. Verified in Postgres: the CHECK
    reads `IN ('house','apartment',...)`.
  - **Postgres `now()` is transaction-start time.** All eight seeded rows in one
    commit share a `created_at`, so "newest first" was nondeterministic. Seed staggers
    timestamps explicitly; the query adds `id` as a tiebreaker.
  - **Pydantic v2 serializes `Decimal` to a JSON *string*.** `price` needed a
    `field_serializer` to honour the number contract. Bonus: Pydantic reads the
    serializer's return annotation, so `/docs` advertises `type: number` too.
  - **`.gitignore` had a blanket `.env*` on the last line** (from the `.vercel`
    commit) shadowing the `!.env.example` negation four lines up — last match wins,
    so `.env.example` was uncommittable. Deleted it; lines 5-7 already covered it.
  - **No `[build-system]` means `app` isn't an installed package** — pytest couldn't
    import it until `pythonpath = ["."]` went into `[tool.pytest.ini_options]`.
  - Starlette 1.3 deprecates httpx in `TestClient`; dev dep is `httpx2` now.
  - Tests are SQLite-only by design (31 tests, 94% coverage). They do **not** cover
    the real `ARRAY` type, the enum CHECKs, or `Numeric` fidelity — those were
    verified by hand against Neon, commands in `backend/README.md`.
  - **Deliberate spec deviations:** added `image_alt` (alt text describes the photo,
    not the listing, and a frontend test asserts alt ≠ title); `currency` is a
    `Literal["LKR"]` on the schema, not a column; enums are VARCHAR + CHECK, not
    native ENUM; "featured" means newest-available-limit-8 with no flag column;
    `GET /properties` deferred to ship with the Phase 2 `search_properties` tool.

### Chat Panel — 2026-08-02
- **What:** The last placeholder region, and the last shell stub of any kind. Static
  agent UI: header band (avatar, name, status dot), four seeded turns from a typed
  fixture, three suggestion chips, and a message input. Every control is real but
  `disabled` — `POST /chat` doesn't exist, so a control that answered a click would
  be lying. `Placeholder.tsx` is gone with its last usage.
- **Key files:** `frontend/lib/chat.ts` (new — `ChatMessage` + seed conversation,
  chips, speaker labels), `frontend/components/chat/ChatPanel.tsx`,
  `frontend/app/globals.css` (`--color-agent-bubble`),
  `frontend/tests/chat-panel.test.tsx`
- **Gotchas/lessons:**
  - **The `lg` collapse was misdiagnosed in the Site Header retro.** It was never
    `items-start` — it was the empty placeholder. `flex-1` is `flex: 1 1 0%`, so a
    region with a zero basis *and* no content resolves to zero height. Real messages
    supply the content; a floor (`min-h-72`, `lg:min-h-64`) supplies the rest. That
    floor must stay under the space left by header + chips + input, or the panel
    pushes its own input off-screen at a short viewport. Measured stuck at 1280×700:
    panel 652px = the cap, input fully visible, only the list scrolling.
  - **A nested `<header>` reports a second `banner`.** Valid HTML inside a
    `<section>`, but the role only narrows where the HTML-AAM scoping rule is
    implemented; `page-structure.test.tsx` caught it as a duplicate landmark. It's a
    plain `<div>` now — same call as the mobile menu using a `<ul>` over a nested
    `<nav>`. **Third landmark-duplication trap in this shell; check before nesting.**
  - `overflow-hidden` on the panel is what clips the header band to the rounded
    corners, and is safe: only *ancestor* overflow breaks a sticky descendant, and
    an element's own outline is painted outside the clip.
  - The ~300px `lg` column is too narrow for the full input placeholder, which got
    sliced mid-word against the send button until `text-ellipsis` was added. Only
    visible in a screenshot — every test and the build passed either way.
  - Colours confirmed in-browser a fourth time: brand `rgb(44, 74, 62)`, agent
    bubble `rgb(230, 238, 234)`, band `rgb(228, 228, 226)`.
  - The CDP driver had to be rebuilt again (it lives in `/tmp` and does not
    survive). It is ~60 lines and dependency-free on Node 24; **note that Chrome
    takes ~6s to open the debug port on this machine — poll `/json/list`, don't
    sleep a fixed 2.5s.**
- **Shell is now complete.** `scope-boundaries.test.tsx` guards bare page
  scaffolding only; every region is in `BUILT_REGIONS`. Next frontend work has no
  placeholder to replace — and the backend still does not exist (Phase 1).

### Featured Properties — 2026-08-02
- **What:** The property grid's first real content. Section header (eyebrow, serif
  `h2`, subcopy) plus eight cards — photo with a location pill, serif title and
  brand-green price on one row, blurb, divider, beds/baths/sqft — rendered from a
  local fixture. Cards are non-interactive; no detail pages exist.
- **Key files:** `frontend/lib/properties.ts` (new — `Property` type + fixtures),
  `frontend/components/properties/` (`PropertyCard`, `PropertyGrid`),
  `frontend/next.config.ts` (`images.remotePatterns`),
  `frontend/tests/property-grid.test.tsx`
- **Gotchas/lessons:**
  - **The Chrome minimum-window-width trap bit again**, exactly as the Hero entry
    warned. `--window-size=375` renders the page wide and *crops* it, so the first
    375px screenshot showed catastrophic overflow that did not exist. Only
    `Emulation.setDeviceMetricsOverride` gives a real narrow viewport. The driver
    used here is a dependency-free Node script over CDP (Node 24 has a global
    `WebSocket`) — worth rebuilding rather than adding puppeteer.
  - **Icons at 14px need eyes on them.** The first bed glyph passed lint, build,
    and every test while rendering as a small flag. Cropping the meta row at
    `deviceScaleFactor: 2` is the only thing that caught it.
  - **Stock photos were matched to listings by looking at them**, then alt text
    written from the image. Havelock Residences is an apartment, so it gets an
    apartment building. Alt describes the photo, not the listing — the title is
    already adjacent.
  - `mt-auto` pins the meta row so dividers align across a row, but it collapses
    to zero on the tallest card — hence `mb-4` on the description rather than a
    margin on the divider, or that one card gets its rule jammed against the text.
  - Don't set `search: ""` in `remotePatterns`: it rejects any URL with a query
    string, and the fixture URLs pass `?w=1600&q=75` so the optimizer downloads a
    sane source instead of a multi-megabyte original.
  - `--color-brand` is confirmed correct a third time: the price samples green
    through antialiasing and resolves to `rgb(44, 74, 62)` in the browser.
- **Left for the chat-panel feature:** `Placeholder.tsx` is now down to a single
  consumer (`ChatPanel`) — delete the file with its last usage.

### Site Header — 2026-08-02
- **What:** Brand link (shared `Logo`), centred nav links as in-page anchors, a
  dark pill chat CTA, and a working mobile menu below `md`. Anchor targets
  (`#featured-properties`, `#contact`, `#chat`) live on the regions themselves.
- **Key files:** `frontend/components/layout/` (`Navbar`, `MobileMenu`,
  `ChatCta`, `nav-links.ts`), `frontend/tests/navbar.test.tsx`
- **Gotchas/lessons:** `@next/next/no-html-link-for-pages` forces `next/link` for
  `href="/"`; using `Link` for the hash anchors too avoids branching per call
  site. The mobile panel unmounts when closed rather than hiding — CSS-hidden
  links stay tabbable and make every `getByRole` ambiguous. A `#chat` jump needs
  `tabIndex={-1}` on the target or focus never follows the viewport. Nesting a
  second `<nav>` inside the panel would double-announce the links, so it's a
  plain `<ul>`.
- **Merge note — three features shipped in parallel off the same `main`, and this
  one merged last.** It duplicated two components that Footer and Hero had each
  built "for the navbar to adopt later", and lost both duplicates on merge:
  its own "Terra & Co." serif wordmark → Footer's shared `Logo` ("Home Advisor");
  its own `components/layout/ChatCta` → Hero's `components/ui/ChatCta`, extended
  here with a `size` prop and an `onClick` (the mobile panel has to close itself).
  Size is a prop, not an overridable class, because two competing `px-*`
  utilities resolve by stylesheet order, not argument order. Dropping the
  wordmark also orphaned the `next/font` Lora wiring, so that came out rather
  than ship a webfont nothing renders — see `b259ec3` if a display face is wanted
  again; it needs a Vitest alias stub, since `next/font/google` is a build-time
  SWC rewrite that throws "Lora is not a function" under Vitest.
  **Lesson: check `main` for a shared component before building one.**
- **Known inconsistency, not introduced here:** the footer styles focus rings with
  `ring-*`, the hero and CTA with `outline-*`. The header follows the CTA. Worth one
  pass to settle on one idiom.
- **Left for the chat-panel feature:** at `lg` the panel's "Message list" region
  collapses to ~0 height — `lg:flex-1 lg:min-h-0` has nothing to fill under
  `items-start`. Pre-existing from the layout shell.

### Hero Section — 2026-08-02
- **What:** First real content on the page. Swapped the hero's four placeholders for
  the eyebrow pill, serif `h1`, subcopy, and green pill CTA from
  `context/ui-interface.png`, and introduced the brand palette as `@theme` tokens.
- **Key files:** `frontend/components/layout/Hero.tsx`,
  `frontend/components/ui/ChatCta.tsx` (new — the navbar needs the same control),
  `frontend/app/globals.css` (brand colours + `--font-display`)
- **Gotchas/lessons:** Brand colours were sampled from the mockup's pixels, not
  eyeballed — re-sample rather than nudging by hand if the mockup changes.
  `--font-display` is deliberately a *system* serif stack; the real pairing
  (Playfair Display + DM Sans is the leading candidate) is deferred to a typography
  feature, and swapping that one token is the whole migration. Verifying this needed
  a real browser over CDP, not jsdom: colours, no-overflow at 375/1440, and
  reduced-motion scroll are all invisible to the test suite. Two traps found that
  way — programmatic `.focus()` does **not** trigger `:focus-visible`, so a focus
  ring reads as absent unless you dispatch a real Tab key; and Chrome's legacy
  `--headless` has a minimum window width, so a 375px screenshot shows fake
  horizontal overflow. Use `--headless=new` + `Emulation.setDeviceMetricsOverride`.
  Merged after Footer and **corrected `--color-brand` from `#1f3d30` to `#2c4a3e`** —
  every green surface in the mockup is the latter; the footer inherits the fix.

### Footer — 2026-08-02
- **What:** First shell region to get real content. Replaced the footer's four
  placeholders with a brand column (logo + blurb), Contact and Follow link lists,
  and a copyright bar, per the mockup. Brand is **Home Advisor** — the mockup's
  "Terra & Co." is placeholder art and is not used anywhere.
- **Key files:** `frontend/components/layout/Footer.tsx`,
  `frontend/components/layout/Logo.tsx` (new, shared — the navbar adopts it in its
  own feature), `frontend/app/globals.css` (`--color-brand`),
  `frontend/tests/footer.test.tsx`
- **Gotchas/lessons:** `scope-boundaries.test.tsx` asserted the *whole* shell was
  free of links and headings — building any region breaks it. It now strips a
  `BUILT_REGIONS` list from the DOM before asserting; **add each region to that
  array as it ships** rather than weakening the assertions. `regions.test.tsx` had
  a Footer block asserting placeholder labels that had to go the same way — expect
  one stale test per region from here on. `--color-brand` (`#1f3d30`) was eyeballed
  off the mockup rather than sampled — **superseded by `#2c4a3e`, see Hero Section
  above.** Social links are `href="#"` with TODOs; no accounts exist yet.

### Basic Frontend Layout — 2026-08-01
- **What:** Stripped create-next-app boilerplate and built the homepage as an empty
  structural shell — navbar, hero, two-column main (property grid + sticky chat
  panel), footer — with every region a labelled placeholder. Each region is now
  its own follow-up feature.
- **Key files:** `frontend/app/page.tsx`, `frontend/components/` (six stubs +
  `Placeholder.tsx`, which is temporary — delete it when the last placeholder goes),
  `frontend/app/globals.css` (`@theme` tokens)
- **Gotchas/lessons:** A sticky element taller than the viewport can never scroll to
  its own bottom — hence `--spacing-panel-max`, which derives from
  `--spacing-panel-inset`; keep them in sync. The page grid needs `items-start` or
  sticky has nothing to slide against. jsdom has no layout engine and ignores
  Tailwind, so responsive/sticky/overflow are browser-only checks; class assertions
  in tests are deletion guards, not proof. Testing Library's auto-cleanup does not
  register without Vitest globals — `tests/setup.ts` calls `afterEach(cleanup)`.

<!-- Repeat block above for each shipped feature -->

---

<!--
  ARCHIVE POINTER (add once history section gets long)
  Older entries (before <date>) moved to: history/2026-archive.md
-->