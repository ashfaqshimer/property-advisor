# Spec: Chat client — wire `ChatPanel` to `POST /chat`

## Goal

Make the chat panel real. A visitor types a question, Amaya answers from the live database
through `POST /chat`, and leads land in Neon. This replaces the `SEED_CONVERSATION` fixture
and enables the controls that are currently rendered `disabled` on purpose.

Also closes the greeting gap `agent-core` deferred to "whoever wires up the panel", which
needs a small backend change alongside the frontend work.

## Context an implementer needs

The backend half is **done and deployed** — read this before writing frontend code:

- **`POST https://property-advisor-96sg.onrender.com/chat`**
  - Request: `{"session_id": str, "message": str}`
  - Response: `{"reply": str, "session_id": str}`
  - `422` — message blank/whitespace-only or >2000 chars; `session_id` blank or >128 chars
  - `502` — Gemini transport/quota/upstream error. No retry server-side, by decision
  - `503` — `GEMINI_API_KEY` missing (a deployment fault, not a user one)
  - Full docs: [backend/README.md](../../../backend/README.md) → Endpoints → `POST /chat`
- **`session_id` is client-generated.** The server never mints one; it get-or-creates a
  conversation keyed on it, and replays history from the `messages` table every turn.
- **A turn is atomic.** `run_turn` commits once at the end, so a failed turn persists
  *nothing* — not even the user's message. This matters for retry: after an error the
  server has no record, so a retry must resend the same text.
- **Measured latency (2026-08-19, Render free tier):** `/health` cold start **~22s**; a warm
  chat turn **4–11s**. So a first message after idle can approach **30 seconds**.
- CORS is an exact-match origin list (`ALLOWED_ORIGINS`), so **Vercel preview deployments
  are blocked** — only the production origin will work unless previews are added by hand.

## Acceptance Criteria

### API client

- [ ] A typed client module (`frontend/lib/api.ts`) exports something like
      `sendChatMessage({ sessionId, message, signal })` returning the parsed
      `{ reply, session_id }`, with the base URL read from
      `process.env.NEXT_PUBLIC_API_URL`.
- [ ] Non-2xx responses become **distinguishable** typed errors, not one generic throw —
      the UI has to say different things for "try again" (502/network/timeout) and
      "this is broken, we know" (503). A 422 is a bug in our own validation and can fall to
      the generic case.
- [ ] A missing or empty `NEXT_PUBLIC_API_URL` fails with a message naming the variable,
      rather than fetching `undefined/chat`.
- [ ] Every request carries a timeout of **~45s** (e.g. `AbortSignal.timeout`), chosen
      against the ~30s worst case above. A timeout is a distinct error, not a silent hang.

### Panel wiring

- [ ] `ChatPanel` becomes a client component (`'use client'`). `app/page.tsx` needs no
      change — a server component can render a client child.
- [ ] `session_id` is generated **once per page load** with `crypto.randomUUID()` and held
      in a ref/state — **never** in `localStorage` or `sessionStorage`. Reloading starts a
      fresh conversation, which keeps the panel and the model's history in agreement.
      Generate it lazily on first send (or in an effect), not in a `useState` initializer
      that also runs during SSR.
- [ ] `SEED_CONVERSATION` is **deleted** from `lib/chat.ts`. `ChatMessage`, `SPEAKER_LABELS`,
      and `SUGGESTION_CHIPS` stay.
- [ ] Sending appends the user's message optimistically, clears the input, and shows a
      pending state; the input, send button, and chips are all disabled while a request is
      in flight.
- [ ] The input + send button become a `<form>` with an `onSubmit`, so **Enter sends**
      without a keydown handler. Send is disabled when the trimmed value is empty or a
      request is pending.
- [ ] Client-side validation mirrors the backend: `maxLength={2000}` on the input, and a
      trimmed-empty submit is a no-op that fires **no request**.
- [ ] Clicking a suggestion chip sends that chip's text as a message.
- [ ] The newest message is scrolled into view as the conversation grows.
- [ ] A fire-and-forget `GET /health` on mount wakes the Render service while the visitor
      reads the page, so their first message doesn't pay the full cold start.
- [ ] **The header copy "Online · replies instantly" is replaced.** With a ~22s cold start
      it is now false, and it sets an expectation the service cannot meet.

### Error and pending states

- [ ] An error leaves the panel usable: the failed user message stays visible marked as
      failed (or is restored to the input) with a **retry** affordance that resends the same
      text — the server discarded the turn, so nothing is duplicated by retrying.
- [ ] A 503 says something honest and different from a transient failure — the key is
      missing server-side and retrying won't help.
- [ ] Because a cold start can run ~30s, the pending state must not look broken: after
      roughly 8–10s it should say something like "still waking up" rather than sit silent.

### Accessibility

- [ ] The message list announces new replies (`aria-live="polite"` on the list, or an
      equivalent), so a screen-reader user learns the answer arrived without hunting.
- [ ] The pending indicator has accessible text ("Amaya is typing…"), not just animated
      dots.
- [ ] Errors are announced (`role="alert"` or an assertive live region).
- [ ] The existing `sr-only` speaker labels and both panel `aria-label`s survive, since
      colour and side alignment are the only visual speaker cues.

### Greeting (needs both sides)

- [ ] A `GREETING` constant beside the persona in `backend/app/agent/prompts.py`, mirrored in
      `frontend/lib/chat.ts`, rendered as Amaya's opening bubble when the panel mounts.
- [ ] `SYSTEM_PROMPT` gains a line stating she has **already greeted** the user, so she
      doesn't greet them a second time.
- [ ] `loop.run_turn` persists the greeting as the assistant turn at **`seq 0`** when the
      conversation is new — i.e. when the **first user message arrives**, never on page
      load, or every bounced visit and crawler hit leaves a junk `conversations` row.
      The user message then lands at `seq 1`.
- [ ] Backend tests: a new conversation persists the greeting at `seq 0`; a second turn does
      **not** insert it again; the contents sent to Gemini open with the greeting as a model
      turn.
- [ ] The greeting text is duplicated across a Python and a TypeScript constant, so both
      files carry a comment pointing at the other. Editing one alone is the failure mode.

### Config and deployment

- [ ] `frontend/.env.local` gets `NEXT_PUBLIC_API_URL` (`http://127.0.0.1:8000` for local
      work against `uv run fastapi dev app/main.py`).
- [ ] The same variable is set in the **Vercel** project, pointing at
      `https://property-advisor-96sg.onrender.com`.
- [ ] `ALLOWED_ORIGINS` on **Render** includes the Vercel production origin. Verified by a
      real browser request, not just curl — curl doesn't send `Origin` and so never trips
      CORS.

### Verification

- [ ] `pnpm test` and `pnpm build` pass from `frontend/`; `uv run pytest` passes from
      `backend/` (the greeting change touches the loop).
- [ ] Existing tests updated rather than deleted — [tests/chat-panel.test.tsx](../../../frontend/tests/chat-panel.test.tsx)
      currently asserts the seeded turns (`~L46`, `~L57`), the chip count (`~L84`), the
      "Online · replies instantly" copy, and that the input and send button are **disabled**
      (`~L93`). Every one of those is now wrong by design.
- [ ] New frontend tests with `fetch` stubbed (no network in the suite): optimistic append,
      pending state, success append, each error class, retry, Enter-to-send, chip send,
      disabled-when-empty, and the 2000-char cap.
- [ ] Manually verified in a browser against the deployed backend: a real multi-turn
      conversation that returns a seeded listing and captures a lead.

## Out of Scope

- **Streaming / token-by-token replies.** The endpoint is one request, one complete reply.
- **Rehydrating history after a reload.** Decided: a reload starts a fresh conversation. Doing
  it properly needs a `GET /chat/{session_id}` endpoint, which is a v2 feature.
- **`GET /properties` and the featured grid.** The grid stays on `lib/properties.ts`
  fixtures; wiring it is its own feature.
- **Markdown or rich rendering** of replies. Plain text in a bubble, as today.
- **Rate limiting, auth, analytics, cost telemetry.** `/chat` is unauthenticated and metered;
  real but not this feature's problem.
- **Dynamic suggestion chips.** They stay the three hardcoded strings.
- **Any lead-confirmation UI.** The reply prose is the only feedback; the database is the
  record.
- **Retry/backoff inside the backend.** Client-side retry is a button the user presses.

## Edge Cases

- **Whitespace-only input** → no request fired, no bubble added.
- **Message at exactly 2000 chars** → accepted; the input's `maxLength` prevents 2001.
- **Double-submit / double-fired effect** → the disabled-while-pending rule should prevent
  it; the backend also survives it (it retries once on the `session_id` UNIQUE race).
- **Cold start on the first message** → up to ~30s. Pending state must stay informative.
- **Backend unreachable** (DNS, offline, CORS rejection) → error state, panel still usable,
  and the message recoverable. Note a CORS failure surfaces in JS as an opaque network
  error, so the copy shouldn't claim to know the cause.
- **503 from a missing key** → distinct copy; retrying is pointless.
- **Reload mid-conversation** → new `session_id`, fresh panel. **Consequence to accept:** a
  visitor who reloads and re-shares their details produces a *second* `leads` row, since
  leads are one-per-conversation.
- **Non-Latin input** (Sinhala/Tamil) → sent and rendered intact; replies stay English.
- **A reply containing one unbroken 200-character token** → existing `wrap-break-word`
  handles it; don't regress it.
- **A reply arriving after the user navigated away** → don't set state on an unmounted
  component.

## Notes

**Read the Next 16 docs, not memory.** Per CLAUDE.md, Next 16 has breaking changes from what
models tend to recall — consult `frontend/node_modules/next/dist/docs/01-app/` before
writing App Router code. Tailwind is v4 configured via `@theme` in `app/globals.css`; there
is no `tailwind.config.ts` and one must not be added. Package manager is pnpm, run from
`frontend/`.

**jsdom has no layout engine and does not apply Tailwind.** It cannot verify the sticky
panel, scroll-into-view, the typing indicator's animation, or that a long conversation
scrolls rather than overflowing. Those stay browser-verified; where a test asserts a Tailwind
class it's a deletion guard and should say so.

**Testing Library's auto-cleanup is registered manually** in `tests/setup.ts` (`afterEach`),
because Vitest globals are off. New test files need no extra wiring.

**Amaya is the persona, Property Advisor is the brand** — the panel names her, the navbar and
footer carry the brand. Don't let the greeting copy blur that, and don't copy any wording
from `context/ui-interface.png`, which is placeholder art.

**Where the backend pieces live:** `backend/app/api/chat.py` (endpoint),
`backend/app/schemas/chat.py` (`MAX_MESSAGE_LENGTH = 2000`, `MAX_SESSION_ID_LENGTH = 128`),
`backend/app/agent/loop.py` (`run_turn`, the greeting change), `backend/app/agent/prompts.py`
(persona, `FALLBACK_REPLY`, and the new `GREETING`). Prior specs worth skimming:
`context/features/done/chat-endpoint/spec.md` and `context/features/done/agent-core/spec.md`.

**Model behaviour is a prompt problem, not a client problem.** If Amaya answers badly, fix
`prompts.py`; per CLAUDE.md the model string is not the lever, and
`gemini-3.1-flash-lite` has been verified chaining `search_properties` → `capture_lead` in
one conversation.
