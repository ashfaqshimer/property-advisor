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

**Feature:** Chat Schema (conversations, messages, leads) — chore

**Spec:** `context/chores/chat-schema/spec.md`

**Goal:**
Add the three remaining tables from PROJECT_OVERVIEW §4 — `conversations`, `messages`,
`leads` — as SQLAlchemy models plus one Alembic migration, so the Phase 2 agent core has
somewhere to persist a conversation and write a captured lead. Database layer only: no
agent code, no endpoints.

**Status:** `In progress`

**Branch:** `chore/chat-schema`

### Approach / Key Decisions

- **Split out of Phase 2 deliberately.** The overview bundles the agent loop with its
  tools, but `capture_lead` has no table and the loop has nowhere to persist turns. The
  properties migration surfaced three non-obvious traps; landing three more tables on
  their own beats debugging schema and a hand-rolled tool-calling loop in one branch.
- **`messages.seq` (int) is the ordering key, not `created_at`.** One agent loop writes a
  user turn, a tool turn, and an assistant turn in a single transaction. Postgres `now()`
  is transaction-start time, so all three share `created_at` — the same nondeterminism the
  seeded properties hit — and a random UUID `id` is no tiebreaker. Consequence here is
  worse than a scrambled grid: it replays a scrambled conversation back to Gemini.
  Unique on `(conversation_id, seq)`; computed Python-side, which keeps it portable to the
  SQLite suite in a way `Identity()` is not.
- **`messages.tool_payload` (JSON, nullable) preserves the raw `function_call` args and
  `function_response`.** §4's `content` text alone cannot faithfully replay a tool pair to
  Gemini. Plain dialect-agnostic `JSON`, not `JSONB` — nothing queries inside it, it's read
  back wholesale to rebuild `contents`.
- **One lead per conversation, enforced by a UNIQUE `conversation_id`.** Makes a second
  `capture_lead` call an update rather than a duplicate row — enforced by the constraint,
  not by trusting the model to call the tool once.
- **`_enum_column` becomes shared rather than copied.** `MessageRole` needs the same
  VARCHAR + named-CHECK helper (with `values_callable`, or the column stores `"USER"`), so
  it moves out of `app/models/property.py` into a module both import. No behaviour change
  to the `properties` table. User approved this touch to an otherwise out-of-scope file.
- Both FKs are `ON DELETE CASCADE`; nothing depends on orphaned messages surviving.

### Files Touched

New:
- `backend/app/models/conversation.py`, `message.py`, `lead.py`
- `backend/app/models/_enum.py` — `enum_column`, moved out of `property.py`
- `backend/alembic/versions/20260817_388fdda07622_create_chat_tables.py`
- `backend/tests/test_chat_models.py` (17 tests)

Modified:
- `backend/app/models/__init__.py` — exports the four new names
- `backend/app/models/property.py` — imports `enum_column` instead of defining it
- `backend/alembic/env.py` — `include_object` filter, see below
- `backend/tests/conftest.py` — `PRAGMA foreign_keys=ON`; docstring corrected
- `backend/README.md` — verification commands for the new tables

### Unplanned finding: autogenerate wanted to drop the properties CHECKs

The first `alembic revision --autogenerate` emitted `op.drop_constraint` for
`ck_properties_property_type` and `ck_properties_property_status` — constraints that are
present and correct on Neon. **Not caused by the `_enum_column` move**; the metadata is
byte-identical before and after, verified against `git show HEAD:...`. Alembic 1.19 reflects
CHECK constraints from the database, but the ones
`Enum(native_enum=False, create_constraint=True)` attaches are `_type_bound` and excluded
from the model side of the comparison, so the database always looks ahead of the models.

Fixed with an `include_object` filter in `alembic/env.py` rather than by hand-deleting the
lines, because it would recur on every future autogenerate — and it now applies to
`ck_messages_message_role` too. The filter matches on **name**: for a removed constraint the
object passed to `include_object` is the reflected one, which carries no `_type_bound` flag
to test. First attempt tested the flag and silently did nothing.

### Open Questions / Blockers

- None blocking. Testability was measured before starting (see spec Notes): Neon is live at
  rev `da5c830b686e`, Docker is available, and there is **no `psql`** — hand-verification
  goes through `uv run python` + SQLAlchemy.
- Only two criteria genuinely need Neon: `Numeric` Decimal fidelity, and confirming the
  live DDL carries the CHECK and both cascades. Everything else runs in `uv run pytest`.

### Next Steps

1. Add a `PRAGMA foreign_keys=ON` connect listener to `tests/conftest.py`'s `db_session`
   fixture. **Do this first** — SQLite silently ignores FKs without it, so a cascade test
   written before this reads as a broken model. `properties` has no FKs; existing tests
   are unaffected.
2. Move `_enum_column` out of `app/models/property.py` into a shared module; update
   `property.py`'s import. Confirm the existing 31 tests still pass — no behaviour change.
3. Write `app/models/conversation.py` (`session_id` unique + indexed).
4. Write `app/models/message.py` (`role` enum via the shared helper, `content`,
   `tool_payload` JSON nullable, `seq`, `UniqueConstraint("conversation_id", "seq")`,
   FK cascade).
5. Write `app/models/lead.py` (all fields nullable except `conversation_id`, which is
   unique; `budget_min`/`budget_max` as `Numeric(14, 2)`; `created_at` + `updated_at`).
6. Export all four new names from `app/models/__init__.py` so Alembic's one-import
   registration still picks up every table.
7. Autogenerate the Alembic revision, chained off `create_properties_table`. Check
   creation order is FK-safe and `downgrade()` reverses it.
8. Add the SQLite tests: ordered round-trip, `seq` collision raises, same `seq` across two
   conversations allowed, `tool_payload` dict + `None`, duplicate lead raises, duplicate
   `session_id` raises, `'USER'` rejected by the CHECK, cascade delete clears children.
9. Correct the `tests/conftest.py` docstring — it claims the suite doesn't cover enum CHECK
   constraints, but SQLite enforces them.
10. Run `uv run pytest`, then `alembic upgrade head` / `downgrade -1` / `alembic check`
    against Neon.
11. Hand-verify the two Postgres-only criteria and record the commands in
    `backend/README.md`.

### Explicitly Out of Scope (for now)

- Any code under `backend/app/agent/` — no Gemini client, no tools, no loop. Phase 2.
- `POST /chat`, `GET /leads`, `GET /properties`. `GET /properties` stays deferred to ship
  with the `search_properties` tool, as the properties retro recorded.
- Pydantic schemas in `app/schemas/` — nothing serializes these tables yet, and guessing a
  response shape before the endpoint exists would be inventing a contract.
- Auth on any future `/leads` view (open question in overview §10).
- Seed data for the new tables. Conversations come from real chats, not fixtures.
- Query helpers in `app/db/queries.py` beyond what the tests need. Get-or-create by
  `session_id` and the lead upsert belong with the code that calls them.
- Any frontend change. It still runs on `lib/properties.ts` and `lib/chat.ts`.

---

## 📜 Feature History

<!--
  Append-only, most recent first. Each entry should be short — 3-5 lines max.
  Goal is "remind me what this was and where the bodies are buried," not a
  full changelog (git already has that).
-->

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