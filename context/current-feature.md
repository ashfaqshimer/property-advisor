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

**Feature:** Agent Core (Phase 2) — the hand-rolled Gemini tool-calling loop

**Spec:** `context/features/agent-core/spec.md`

**Goal:**
A `run_turn(session_id, user_message)` entry point that sends conversation history plus
tool declarations to Gemini, executes `search_properties` / `capture_lead` when the model
calls them, persists every turn to the chat tables, and returns the final assistant text.
Exercisable from pytest and a throwaway script — **no HTTP endpoint in this phase.**

**Status:** `In progress`

**Branch:** `feature/agent-core`

### Approach / Key Decisions

<!-- Settled with the user in the refinement conversation before the spec was drafted —
     not derived from the spec. Don't relitigate these while implementing. -->

- **The assistant is Amaya** — female, early twenties, she/her, an advisor *at* Home
  Advisor. Home Advisor is the brokerage, not her name. This **supersedes the old
  CLAUDE.md branding line**, which is amended in this branch. Her age is load-bearing
  rather than decoration: it's why the prompt forbids claiming experience and routes
  valuations, commissions, and timelines to a senior agent — persona and
  no-overclaiming rules reinforce each other.
- **Amaya never claims to be human and invents no biography.** Asked directly, she says
  she's Home Advisor's AI assistant and carries on; she doesn't lead with it unprompted,
  doesn't volunteer her age, and improvises no university or years-in-the-business.
- **`search_properties` never returns a bare `[]`.** Zero matches return
  `{matches: [], guidance: "..."}` telling the model not to say we have nothing, to offer
  an agent check including unpublished stock, and to ask for a name and number.
  Belt-and-braces with the prompt: a bare empty list invites "no results found" no matter
  what the system instruction says, and that failure is *silent*.
- **`leads.intent`** — new nullable enum (`buy` | `rent` | `sell`) via the existing
  `enum_column()` helper, plus an `intent` param on `capture_lead`. Chosen over stuffing
  seller details into free-text `preferences` so seller leads stay filterable.
- **The filter query goes in `app/db/queries.py`, not `tools.py`** — reversing that file's
  current docstring, which says the opposite. Reason: the Phase 3 `GET /properties`
  endpoint shouldn't have to import from the agent package. Update the docstring rather
  than leaving it contradicting the code.
- **English-only replies. Process-only seller differentiators, zero comparative claims**
  about other agents. No valuations, commissions, or timelines.
- Loop capped at 5 iterations; model string stays in `app/config.py`. Raw `google-genai`,
  no framework — this is the point of the project, not an implementation detail.

### Files Touched

- `CLAUDE.md` — branding line amended for the Amaya persona
- `context/features/agent-core/spec.md` — the spec
- `backend/pyproject.toml` — `google-genai` 2.18.1; dev: `pytest-cov`
- `backend/app/agent/` — `__init__.py`, `prompts.py`, `client.py`, `tools.py`, `loop.py`
- `backend/app/models/lead.py` — `LeadIntent` + `intent` column; exported in `models/__init__.py`
- `backend/app/db/queries.py` — `search_properties()` + reversed docstring
- `backend/alembic/versions/20260818_c9432564c721_add_leads_intent.py`
- `backend/tests/` — `agent_fakes.py`, `test_agent_prompts.py`, `test_agent_tools.py`,
  `test_agent_loop.py`, and a `TestLeadIntent` block in `test_chat_models.py`
- `backend/scripts/chat.py` — terminal REPL for talking to Amaya, since there's no endpoint
  until Phase 3. Defaults to throwaway in-memory SQLite; `--neon` writes to the real
  database; `--verbose` prints the loop's function calls and tool payloads.
- `backend/README.md` — a "Talking to the agent" section covering the above

### Resolved While Building

- **`op.add_column` *does* emit the type-bound CHECK.** The open question on the migration
  turned out not to bite: Neon holds `ck_leads_lead_intent` with `IN ('buy','rent','sell')`
  and rejects `'banana'`. Checked in the catalog rather than inferred from the column.
  A follow-up autogenerate came back empty, so `_type_bound_check_names()` absorbed the new
  constraint by itself, as designed.
- **140 tests, 0.9s, no network.** `app/agent/` coverage: `loop.py` 100%, `tools.py` 100%,
  `prompts.py` 100%, `client.py` 96% — the one uncovered line is the live
  `generate_content` call, which by definition can't run offline. Project total 97%.
  `pytest-cov` is now a dev dependency; the properties retro's "94%" had been measured
  ad hoc.
- **Live `flash-lite` chains tools fine** and extracted four parameters from one sentence
  ("3 bedroom house in Jaffna, budget around 40 million" → `location`, `property_type`,
  `bedrooms`, `budget_max`). No model upgrade needed.

### Live Verification Results (gemini-3.1-flash-lite)

Run against in-memory SQLite seeded with the eight real listings — deliberately *not* Neon,
so throwaway conversations leave no rows in production.

- ✅ **Zero match (the headline criterion).** Jaffna search → `match_count=0`. She named no
  property, did not say we have nothing or that we don't cover Jaffna, offered a senior
  agent check "including unpublished stock", and asked for a name and number.
- ✅ **Seller.** Asked point-blank "why you and not another agent", she answered with
  process only — walkthrough, comparables pricing, in-house photography, pre-qualified
  buyers — and made no comparative claim. Refused both the valuation and the commission,
  deferring to a senior agent.
- ✅ **Sinhala in, English out.** Romanised Sinhala got an English reply (with "Ayubowan!"),
  and she asked one clarifying question before searching rather than guessing.
- ✅ **AI disclosure.** "Are you a real person or a bot?" → "I'm Home Advisor's AI
  assistant", then straight back to helping. No deflection, no claim to be human.
- ✅ **Declines contact details** — after the rule below was settled and the prompt
  reconciled to it. She takes the "no" ("no pressure at all") and keeps helping without
  re-asking; then, when nothing else is published, makes exactly one offer of a senior-agent
  check and closes with "Either way, I am happy to keep monitoring the new listings for you
  here." Took three passes at the wording: the first live run re-asked in disguise, a flat
  ban then contradicted the brief, and the third encodes the decision.

### Resolved Decisions

- **The re-ask rule.** "Ask once then drop it" and "on empty inventory, offer the agent
  check and try for their details" genuinely conflict — the second *is* a second ask — and
  the conflict was in the original brief, not the implementation. **Settled: one low-key
  re-offer is allowed** when nothing published matches and an agent would have to dig,
  provided she says in the same breath that she'll keep looking either way. Repeating the ask
  turn after turn is still wrong. `prompts.py` and the spec's manual criterion both say this
  now; an earlier, stricter wording that forbade it has been removed so the two can't fight.
- **The opening greeting: deferred to Phase 4.** A *generated* greeting was rejected — a
  model call before the user types costs tokens per page view, stacks latency on Render's
  cold start, and can't say anything useful. The static one belongs with the panel that
  renders it. **The trap is written into the spec's Out of Scope section**: a greeting shown
  in the UI but never persisted makes the model greet a second time, and no test can see it.

### Open Questions / Blockers

- Retries/backoff on Gemini transport errors are deliberately absent — a transport error
  propagates out of `run_turn`. Deferred to Phase 5, on purpose: a silent retry now would
  hide the flakiness worth measuring first.
- `scripts/chat.py --neon` is the one path never run: it writes real rows, so it was left
  for the owner rather than exercised here.

### Next Steps

1. Commit (nothing is committed yet beyond the earlier tracker/spec commit).
2. `complete-feature agent-core`.

### Explicitly Out of Scope (for now)

- **`POST /chat`** — Phase 3, its own feature. This phase ends at a callable Python function.
- **`GET /properties`** — deferred again to Phase 3. The *filter query* ships here; the
  endpoint doesn't, because this phase is deliberately endpoint-free.
- **`get_property_details`** — optional per the overview; a small addition once the loop
  exists.
- **The frontend rename to Amaya** — it still says "Home Advisor" in 6 code sites plus 5
  test assertions (`lib/chat.ts`, `components/chat/ChatPanel.tsx`,
  `tests/chat-panel.test.tsx`). Pending work, not a second opinion; Phase 4 touches those
  files anyway.
- `GET /leads` and auth on it; streaming responses; all other frontend work; Sinhala or
  Tamil *generation*; retry/backoff, rate limiting, cost telemetry.

---

## 📜 Feature History

<!--
  Append-only, most recent first. Each entry should be short — 3-5 lines max.
  Goal is "remind me what this was and where the bodies are buried," not a
  full changelog (git already has that).
-->

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