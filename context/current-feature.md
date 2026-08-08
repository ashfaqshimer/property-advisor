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

**Feature:** Backend Properties API

**Spec:** `context/features/backend-properties-api/spec.md`

**Goal:**
Stand up the database layer the backend has been waiting on: a `properties` table on
Neon Postgres, migrated with Alembic, seeded with the eight listings the homepage
already renders, and readable over HTTP at `GET /properties/featured`. Phase 1 of
PROJECT_OVERVIEW §9, scoped to one table and one endpoint.

**Status:** `In review/testing`

**Branch:** `feature/backend-properties-api`

### Approach / Key Decisions
<!--
  Why you're building it this way — especially anything non-obvious.
  This is the highest-value section: code shows WHAT, this shows WHY.
-->
- **Sync SQLAlchemy 2.0 + psycopg3, not async.** The Phase 2 Gemini loop is sequential
  and blocking; an async endpoint would end up threadpooling it anyway, and async
  SQLAlchemy under a threadpooled blocking loop is the worst of both. psycopg3
  specifically because it's the same driver in both modes — going async later changes
  `create_engine` and nothing else.
- **`image_alt` column added beyond spec §4.** Alt text describes the photograph, not
  the listing, so it can't be derived from `title` — and `property-grid.test.tsx`
  already asserts `not.toHaveAccessibleName(sample.title)`.
- **Enums as `VARCHAR` + named CHECK, not native PG `ENUM`.** Adding a member later is
  an ordinary migration instead of an `ALTER TYPE`, and the Phase 2 tool can compare
  raw model output uncast. Needs `values_callable` or SQLAlchemy persists the member
  *name* (`"HOUSE"`) and every lowercase query silently returns nothing.
- **"Featured" = newest available, limit 8.** No `featured` column: with eight listings
  a boolean would be true on every row and encode nothing.
- **`price` as a JSON number + `currency: "LKR"` on the schema, not in the table.**
  Note Pydantic v2 serializes `Decimal` to a *string* by default — needs an explicit
  `field_serializer`.
- Full plan with code sketches: `~/.claude/plans/lets-work-on-getting-dreamy-wigderson.md`

**Confirmed during the build:**
- The `values_callable` worry was real — the Postgres CHECK reads
  `property_type IN ('house','apartment',...)`, lowercase, as intended.
- `pyproject.toml` has no `[build-system]`, so `app` isn't installed as a package and
  pytest couldn't import it. `pythonpath = ["."]` in `[tool.pytest.ini_options]` fixes it.
- Starlette 1.3 deprecates httpx in `TestClient`; swapped the dev dep to `httpx2`,
  which cleared the warning, and dropped the now-redundant explicit `httpx`.
- Pydantic infers the OpenAPI type from the `field_serializer` return annotation, so
  `price` advertises as `number` in `/docs`, not just at runtime.

### Files Touched
<!-- Running list so Claude Code doesn't have to grep the whole repo to find scope -->
- **New (backend):** `app/config.py`, `app/db/{base,session,queries,seed,seed_data}.py`,
  `app/models/{__init__,property}.py`, `app/schemas/{__init__,property}.py`,
  `app/api/{__init__,properties}.py`, `alembic.ini`, `alembic/env.py`,
  `alembic/versions/20260809_da5c830b686e_create_properties_table.py`,
  `tests/{conftest,test_health,test_seed_data,test_properties_featured,test_property_schema}.py`,
  `.env.example`, `README.md`
- **Modified:** `backend/app/main.py` (router + CORS), `backend/pyproject.toml`,
  `.gitignore` (deleted the shadowing `.env*`), `CLAUDE.md` (Current state was stale in
  both halves; added a Backend testing section)

### Open Questions / Blockers
<!-- Anything unresolved. Delete once resolved, don't let these pile up stale. -->
- None. Both prior blockers are resolved: `.gitignore` line 33 deleted (`.env.example`
  is trackable, real env files still ignored via line 5), and CLAUDE.md rewritten.

### Next Steps
<!-- Ordered, small, actionable. This is what Claude Code should tackle first. -->
1. Review the diff, then commit (nothing is committed beyond the tracker).
2. Run `complete-feature` to verify against the spec's acceptance criteria.
3. Next slice, separately specced: wire `PropertyGrid` to the endpoint — needs a price
   formatter (`185000000` → "LKR 185M"), `NEXT_PUBLIC_API_URL`, and an adapter for
   `bedrooms`→`beds` / `image_urls[0]`→`imageUrl`.

### Explicitly Out of Scope (for now)
<!-- Prevents Claude Code from "helpfully" expanding scope mid-task. -->
- **Any frontend change.** `PropertyGrid` keeps importing `lib/properties.ts`.
- **`GET /properties` with filters** — its filters are the Phase 2 `search_properties`
  tool's filters; building them in two places invites drift.
- **`leads`, `conversations`, `messages` tables** — Phase 2/3.
- **Anything Gemini.** Settings declares the key and model string; nothing reads them.
- **`GET /leads`, auth, rate limiting.**
- **Deployment to Render** — README notes the commands, but it isn't done.
- **A `featured` boolean column** and **a `slug` column.**

---

## 📜 Feature History

<!--
  Append-only, most recent first. Each entry should be short — 3-5 lines max.
  Goal is "remind me what this was and where the bodies are buried," not a
  full changelog (git already has that).
-->

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