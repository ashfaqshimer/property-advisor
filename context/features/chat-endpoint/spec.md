# Spec: `POST /chat` — HTTP surface for the agent loop

## Goal

Expose the existing `loop.run_turn` over HTTP so a browser can hold a conversation with
Amaya. Phase 2 ended at a callable Python function; this feature is the thin, well-validated
layer that makes it reachable — request/response schemas, error mapping, and a testable
Gemini dependency. No frontend work: the endpoint is done when `curl` can hold a
multi-turn conversation against the deployed service.

## Acceptance Criteria

- [ ] `POST /chat` accepts `{"session_id": str, "message": str}` and returns
      `{"reply": str, "session_id": str}`, defined as Pydantic models in
      `app/schemas/chat.py` (the package currently holds only `property.py`).
- [ ] The router lives in `app/api/chat.py` and is mounted in `app/main.py` alongside
      `properties.router`. No CORS change is needed — `allow_methods` already includes
      `POST`.
- [ ] The endpoint is defined with `def`, **not** `async def`. `run_turn` is synchronous
      and does blocking I/O (Gemini + Postgres); under `async def` it would block the
      event loop for the whole turn and serialise every concurrent user.
- [ ] The Gemini client is injected via a FastAPI dependency (e.g. `get_agent_client`)
      that the test suite overrides the same way `conftest.py` overrides `get_db`. **No
      test may make a network call**, and none may reach `patch()` — `run_turn` already
      takes `client` for exactly this reason.
- [ ] Validation happens at the schema layer, so `run_turn`'s own
      `ValueError("user_message must not be empty")` is unreachable from HTTP:
      `message` is `min_length=1` after stripping and `max_length=2000`; `session_id` is
      `min_length=1`, `max_length=128` (matching `Conversation.session_id`'s `String(128)`).
      All three violations return **422**, not 500.
- [ ] A blank or missing `GEMINI_API_KEY` surfaces as **503** with an actionable message,
      not a 500 traceback — `client.GeminiNotConfigured` is raised on first use and must be
      mapped.
- [ ] An error from Gemini itself returns **502** — `google.genai.errors.APIError`, the base
      of `ClientError`/`ServerError`, which covers transport, quota, and upstream 5xx. Per
      `loop.py`'s docstring, retries and backoff stay out; this only gives the failure an
      HTTP shape, and the upstream message is not forwarded to the caller.
      **Amended during implementation:** a *safety* block was originally listed here as a
      502. It isn't one — it arrives as a candidate-less response rather than an exception,
      so the loop already turns it into `FALLBACK_REPLY` and a 200, same as exhausting
      `MAX_TOOL_ITERATIONS`.
- [ ] Reusing a `session_id` across two requests continues the same conversation: the
      second reply demonstrably reflects the first turn, verified through the endpoint with
      a scripted fake client (not by calling `run_turn` directly).
- [ ] Tests cover the tool path end to end through HTTP: a fake client that returns a
      `search_properties` `function_call` then prose yields a 200 with the prose, and the
      `messages` rows for that conversation include the tool exchange.
- [ ] `GEMINI_API_KEY` is set in the Render dashboard and a real multi-turn conversation is
      verified against `https://property-advisor-96sg.onrender.com/chat` — including one
      turn that triggers `search_properties` and returns a real seeded listing.
- [ ] `uv run pytest` passes; `backend/README.md` documents the endpoint and the fact that
      production now needs `GEMINI_API_KEY` (its Deploying section currently states the
      opposite).

## Out of Scope

- **All frontend work.** `ChatPanel` stays on its fixture with controls disabled; that's
  the `chat-client` feature, specced next and deliberately written against this endpoint
  once it's live.
- **The opening greeting.** Deferred by `agent-core` to the feature that wires up the panel,
  because "two hellos" is only observable there. Carrying the trap forward so it isn't lost:
  it needs a change on *both* sides — persist the greeting as the assistant turn at `seq 0`
  when the **first user message** arrives (never on page load, or every bounced visit and
  crawler hit leaves a junk `conversations` row), plus a `SYSTEM_PROMPT` line saying she has
  already greeted them, with the text as a constant beside the persona in `prompts.py`.
- **`GET /properties`** — deferred again. Nothing in the chat path needs it; the
  `search_properties` filter query already exists.
- **Streaming / SSE.** One request, one complete reply, consistent with `agent-core`.
- **Rate limiting, auth, and cost telemetry.** Noted below as a real exposure, not solved
  here.
- **`get_property_details`**, `GET /leads`, and retry/backoff on Gemini — all still Phase 5
  or optional.
- Returning tool metadata (matched property ids, whether a lead was captured) in the
  response body. The reply is prose; the database is the record.

## Edge Cases

- **Whitespace-only `message`** (`"   "`) → 422. `min_length=1` alone does not catch this;
  strip before validating.
- **Brand-new `session_id`** → conversation created, 200, no error.
- **Two concurrent first requests for the same `session_id`** → must not 500.
  `session_id` is UNIQUE, so `get_or_create_conversation` will lose the race and raise
  `IntegrityError`; catch it, re-select, and continue. A double-submitting client or a
  double-fired effect makes this reachable in practice, not just in theory.
- **Gemini fails mid-loop** → the turn is atomic and leaves **no trace**: `run_turn`
  flushes rows but only commits at the end, and `get_db` closes without an explicit
  rollback, which SQLAlchemy turns into a rollback of the open transaction. So a failed
  turn discards the user's message too. Accepted deliberately — a half-persisted
  conversation would poison every later turn, since history is replayed from `messages`.
  It does mean failures are invisible in the database; log them.
- **`message` at exactly 2000 chars** → accepted; 2001 → 422.
- **Non-Latin input** (Sinhala/Tamil) → accepted and persisted intact; replies stay English
  by decision.
- **Loop cap reached** → 200 with `FALLBACK_REPLY`, conversation persisted. Already handled
  in `run_turn`; assert it survives the HTTP layer.
- **Cold start + a 5-iteration turn** → a single request can take tens of seconds on
  Render's free tier. The endpoint does nothing about this; the frontend spec owns the
  timeout and pending UI.

## Notes

The loop is already built and tested — `loop.run_turn`, `tools.search_properties` /
`tools.capture_lead`, `prompts.SYSTEM_PROMPT`, `client.GeminiClient` — merged in `fa8430d`
with `test_agent_loop.py`, `test_agent_tools.py`, and `test_agent_prompts.py`. **This
feature adds no agent behaviour.** If a reply is wrong, that's a prompt bug fixed in
`prompts.py`, and per CLAUDE.md the model string is not the lever.

`run_turn(db, session_id, user_message, client=None)` returns the reply string and commits.
The endpoint's whole job is validate → call → shape errors.

**Unauthenticated and it costs money per call.** Every request is up to five Gemini calls
against a public URL with no rate limit. The `max_length=2000` cap bounds a single request
and `MAX_TOOL_ITERATIONS` bounds one turn, but nothing bounds request *volume*. Acceptable
for a demo on the cheapest model tier; flag it before this gets real traffic, and don't
treat the caps above as a substitute for rate limiting.

Session ids are client-generated — this endpoint accepts any string up to 128 chars and
never mints one. Where the browser gets its id (and how it survives a reload) is the
`chat-client` feature's decision.
