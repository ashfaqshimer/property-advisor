# Spec: Agent Core (Phase 2)

## Goal

Build the hand-rolled Gemini tool-calling loop: a `run_turn(session_id, user_message)`
entry point that sends conversation history plus tool declarations to Gemini, executes
`search_properties` / `capture_lead` when the model calls them, persists every turn to
the chat tables, and returns the final assistant text. Exercisable from pytest and a
throwaway script — **no HTTP endpoint in this phase.**

## Acceptance Criteria

### Dependency and client

- [ ] `google-genai` is a runtime dependency in `backend/pyproject.toml`; `uv sync` succeeds.
- [ ] `grep -riE 'langchain|langgraph|llama_index|crewai' backend/pyproject.toml backend/app`
      returns nothing. The loop is hand-rolled — this is the point of the project.
- [ ] `app/agent/client.py` wraps the SDK and is the only module that constructs a
      `genai.Client`.
- [ ] The model string is read from `get_settings().gemini_model`. `grep -rn
      'gemini-3.1-flash' backend/app` matches `app/config.py` and nothing else.
- [ ] A missing/empty `GEMINI_API_KEY` raises a clear, named error on first client use —
      not an opaque SDK stacktrace, and not at import time (the suite imports `app.agent`
      without a key set).

### System prompt

- [ ] `app/agent/prompts.py` exposes `SYSTEM_PROMPT` containing the settled persona text
      (see Notes) verbatim, including the who-you-are section, the inventory rule, the
      seller section, the contact-details cadence, the English-only rule, and the
      `## Never` list.
- [ ] The assistant is named **Amaya** — she/her, early twenties. A test asserts
      `"Amaya"` is in `SYSTEM_PROMPT`, and that the prompt does not name the assistant
      "Home Advisor" (that's the brokerage, not the person).
- [ ] No persona/instruction strings live in `loop.py`, `tools.py`, or `client.py`.
- [ ] `grep -ri 'terra' backend/app` returns nothing (brand rule — the mockup's wording is
      placeholder art).

### Tools

- [ ] `search_properties(location?, budget_min?, budget_max?, property_type?, bedrooms?)`
      filters `properties`, returns **at most 5** rows, and returns only
      `status == available` listings.
- [ ] Every parameter is optional and omitting one widens rather than narrows the search.
- [ ] **On zero matches the return value is never a bare `[]`.** It is a dict carrying both
      `matches: []` and a `guidance` string instructing the model not to say we have
      nothing, to offer an agent check including unpublished stock, and to ask for a name
      and number.
- [ ] `capture_lead(name?, phone?, intent?, budget_min?, budget_max?, preferences?)` writes
      a row in `leads` linked to the current conversation.
- [ ] A second `capture_lead` call in the same conversation **updates** that row rather than
      raising on the UNIQUE constraint or inserting a duplicate, and a later call does not
      blank a field an earlier call filled.
- [ ] `capture_lead` with neither name nor phone nor preferences does not create an empty
      row; it returns a payload telling the model what is still missing.
- [ ] Tool schemas are hand-written `FunctionDeclaration`s passed via
      `GenerateContentConfig(tools=[...])`, with descriptions written for the model to read.
- [ ] Both tools take an explicit `Session`; neither opens its own database connection.

### `leads.intent` migration

- [ ] `Lead.intent` is a nullable enum column (`buy` | `rent` | `sell`) built with the
      existing `enum_column()` helper, so it is VARCHAR + a named CHECK, not a native ENUM.
- [ ] The CHECK constraint name follows the existing `ck_<table>_<enum>` convention.
- [ ] The migration is applied to Neon and `uv run alembic current` reports the new head.
- [ ] **The CHECK constraint actually exists in Neon after the upgrade** — verified by
      querying the catalog, not inferred from the column existing. Alembic's `add_column`
      does not reliably emit a type-bound CHECK when adding an enum column to an existing
      table; if it doesn't, the migration writes it explicitly.
- [ ] A follow-up `alembic revision --autogenerate` produces an **empty** migration,
      confirming `_type_bound_check_names()` in `alembic/env.py` picked up the new
      constraint automatically (it derives from the models, so it should — this criterion
      proves it rather than assuming it).
- [ ] `downgrade()` drops the column, and the CHECK with it.
- [ ] A test asserts an invalid `intent` value is rejected (SQLite enforces CHECKs, so this
      belongs in the fast suite).

### The loop

- [ ] `app/agent/loop.py` implements exactly the documented cycle: append the user message →
      send full contents + tool declarations + system instruction → if a `function_call`
      part comes back, execute the Python function and append the model turn plus a
      `function_response` part → repeat until a plain text response.
- [ ] Iterations are capped at 5. A fake client that returns a `function_call` every time
      stops after exactly 5 model calls and returns a graceful fallback message — it does
      not raise, and does not loop forever.
- [ ] A `function_call` naming an unknown tool returns an error `function_response` the
      model can recover from, rather than raising.
- [ ] A response carrying both text and a `function_call` executes the call rather than
      returning early on the text.
- [ ] The conversation is looked up by `session_id` and created if absent; a second call
      with the same `session_id` continues the same conversation.
- [ ] Every turn is persisted to `messages` with contiguous `seq` values in order — user,
      each tool turn, and the final assistant text. `tool_payload` holds the
      `function_call` / `function_response` data, since `content` text cannot replay it.
- [ ] History is replayed to Gemini ordered by `seq`, not `created_at` (one loop pass writes
      several rows in one transaction and Postgres `now()` is transaction-start time).

### Tests

- [ ] **No test makes a live Gemini call.** A fake/scripted client stands in, and the suite
      still runs offline in under a second.
- [ ] Truthfulness test (automated half): with the eight seeded listings, a scripted
      `search_properties` call that matches nothing — `property_type="land"`, or
      `location="Jaffna"` — returns `matches: []` **and** a non-empty `guidance` string.
      This is the regression guard that the tool payload can never contradict the prompt.
- [ ] Loop-cap, unknown-tool, `capture_lead`-upsert, and `seq`-ordering cases each have a
      test.
- [ ] `uv run pytest` passes; coverage of `app/agent/` is reported and no module is
      substantially untested.

### Manual verification (cannot be automated)

- [ ] One real conversation against `gemini-3.1-flash-lite` is run and its transcript
      recorded in the tracker: ask for something with zero matches (a 3-bedroom in Jaffna).
      **The reply must name no property and must not say we have nothing or don't cover the
      area.** A mocked test cannot prove this — the fake client supplies the reply text —
      so the model-behaviour half of the headline criterion is a human check.
- [ ] One seller conversation: the agent stays process-only, makes no comparative claim
      about other agents, and quotes no valuation, commission, or timeline.
- [ ] One message written in Sinhala gets an English reply.
- [ ] A conversation where the user declines to give contact details: the agent asks once,
      then drops it and keeps helping.
- [ ] Asked "are you a real person?" / "am I talking to a human?", Amaya says plainly she's
      Home Advisor's AI assistant and carries on — she does not deflect and does not claim
      to be human.
- [ ] Asked personal questions ("how old are you?", "where did you study?", "how long have
      you been an agent?"), she declines to invent a biography and redirects to the work.

## Out of Scope

- **`POST /chat`** — Phase 3, its own feature. This phase ends at a callable Python
  function.
- **`GET /properties`** — deferred again, to Phase 3 alongside `/chat`. The properties
  retro said it should "ship with the Phase 2 `search_properties` tool"; what ships here is
  the *filter query*, not the endpoint, because this phase is deliberately endpoint-free.
  See Notes for where that query lives.
- **`get_property_details`** — `PROJECT_OVERVIEW` §5 marks it optional. Adding a third tool
  is a small change once the loop exists; leaving it out keeps this phase reviewable.
- `GET /leads` and any auth on it.
- Streaming / token-by-token responses. One request, one complete reply.
- Any frontend work. `ChatPanel` stays on its fixture and its controls stay disabled.
- Sinhala or Tamil *generation* (replies are English-only by decision).
- Retry/backoff on Gemini errors, rate limiting, and cost telemetry.

## Edge Cases

- **Zero search results** → `matches: []` plus `guidance`. Never a bare empty list.
- **Loop cap reached** → graceful fallback text, conversation still persisted.
- **Model sends malformed arguments** (budget as `"5 million"`, an unknown
  `property_type`, a negative bedroom count) → the tool coerces what it safely can and
  otherwise returns an error payload the model can retry from. It must not 500.
- **`capture_lead` called twice** → update, don't duplicate, don't blank filled fields.
- **`capture_lead` with nothing useful** → no row, return what's missing.
- **Unknown tool name in a `function_call`** → error `function_response`, loop continues.
- **Gemini returns no candidates / an empty response** → fallback text, no crash.
- **Empty or whitespace-only user message** → rejected before a model call is spent.
- **Missing `GEMINI_API_KEY`** → clear named error on first use.
- **A user asks the agent to invent a listing** ("just make up something in Jaffna") → it
  declines and offers the agent-check path instead.
- **A brand-new `session_id`** → conversation created, no error.

## Notes

**Settled system prompt.** The persona was refined with the user in this session and is
settled — don't redesign it while implementing. Full text:

```
You are Amaya, an advisor at Home Advisor — a real estate brokerage based in
Colombo, working across Sri Lanka.

## Who you are
Amaya — she/her, early twenties, Colombo. Warm, quick, and straightforward; you
like this work and it shows. You know the market and our listings well, but you
don't claim experience you don't have: anything needing sign-off — a valuation,
a commission, a timeline — goes to a senior agent.

Don't invent a biography. No backstory, no university, no "I've been doing this
for years", and don't volunteer your age. If someone asks whether you're a real
person, tell them plainly that you're Home Advisor's AI assistant and carry on
helping — don't lead with it unprompted, and never claim to be human.

## Inventory: the rule that overrides everything
Only ever describe a property that a tool call returned to you. Never invent
a listing, price, address, or availability — not even as an illustration.

Our published listings are a slice of what we work with; owners often come to
us before anything goes public. So when search_properties returns nothing:
- Do NOT say we have nothing in that area, or that we don't cover it.
- Say an agent will check what's available, including unpublished stock, and
  come back to them.
- Get a name and a number so someone can.

## Buyers and renters
Ask one clarifying question at a time — budget, area, property type — before
searching. Once you have enough to narrow it down, search. Describe what came
back in prose, not as a list dump.

## Sellers
Take them seriously; this is the side of the business we most want. When asked
why us, talk about how we work — a walkthrough and a comparables-based price,
photography and listing copy handled in-house, buyers pre-qualified before
anyone views. Make no comparative claims about other agents, named or not.
Never quote a valuation, a commission, or a timeline; an agent confirms those.
Aim to hand over with the property's location, type, rough size, and their
contact details.

## Contact details
Earn them, don't demand them. Help first; ask once, naturally, once you have
something worth following up on. If they decline, drop it and keep helping —
do not ask again. Capture whatever you get, even a number without a name.

## Language
Respond in English. If someone writes in Sinhala or Tamil, reply in English
and keep it simple — an agent can follow up in their language.

## Style
Short, warm, conversational — two or three sentences, not a bulleted report.
Contractions are natural; emoji, slang, and stacked exclamation marks are not.
LKR for prices; local shorthand where natural (Colombo 5, perches for land).

## Never
- Invent properties, prices, or availability.
- Claim to be human, or invent personal history.
- Say we can't help, or that we don't cover an area.
- Give legal, tax, or financing advice, or promise a price or timeline.
- Overclaim. Confident and professional beats salesy.
```

**Four decisions carried in from the refinement conversation:**

0. The assistant is **Amaya** — female, early twenties, she/her. This *supersedes* the
   CLAUDE.md branding line that said the agent's name is "Home Advisor"; that line has
   been amended, because leaving it would have had a future session rename her back.
   Home Advisor is the brokerage she works for. Her age is why the prompt forbids claiming
   experience and pushes valuations, commissions, and timelines to a senior agent — the
   persona and the no-overclaiming rules reinforce each other rather than fighting.
   **The frontend still calls the assistant "Home Advisor" in 6 places plus 5 test
   assertions** (`lib/chat.ts`, `components/chat/ChatPanel.tsx`,
   `tests/chat-panel.test.tsx`). That rename is deliberately *not* in this phase — it's
   frontend work, it breaks tests, and Phase 4 wiring will touch those files anyway.
1. `leads.intent` (`buy` | `rent` | `sell`, nullable) plus an `intent` param on
   `capture_lead` — chosen over stuffing seller details into free-text `preferences`, so
   seller leads are filterable later.
2. `search_properties` carries guidance in its zero-match payload. Belt-and-braces with the
   prompt: a bare `[]` invites "no results found" no matter what the system instruction
   says, and that failure is silent.
3. English-only replies; process-only seller differentiators with zero comparative claims.

**Where the filter query lives.** `app/db/queries.py` currently says filtered search
"deliberately lives with the Phase 2 `search_properties` tool rather than here". Reversing
that: the query goes in `queries.py` and `tools.py` calls it, so the Phase 3
`GET /properties` endpoint doesn't have to import from the agent package. Update that
docstring rather than leaving it contradicting the code.

**Expect the autogenerate false positive.** This is the fifth migration and it touches an
enum column. `alembic/env.py`'s `include_object` filter should absorb it automatically —
it collects `_type_bound` CHECK names from the models rather than hardcoding them — but
verify, and never apply a migration that wants to drop a `ck_*` constraint.

**Testability limits, stated up front** (the pattern the last two retros established):
a mocked Gemini proves the *tool contract* and the *loop mechanics*. It cannot prove the
model obeys the prompt, because the fake supplies the reply text. Prompt adherence is a
manual check against the live model, listed separately above. Don't let a green suite read
as proof the persona works.

**Model swap is a last resort.** If `flash-lite` won't chain `search_properties` →
`capture_lead`, fix the prompt first. The non-lite Flash of the same generation is a
one-string upgrade in `app/config.py`, but reaching for it to paper over a prompt bug is
explicitly out of bounds per CLAUDE.md.

**Grounding facts checked while drafting this:** `gemini_api_key` and `gemini_model` are
already in `Settings` (unused). The eight seeded listings cover Colombo 3/5/7, Galle,
Kandy, and Rajagiriya, and are all `HOUSE` or `APARTMENT` — so `property_type="land"` and
`location="Jaffna"` are both guaranteed zero-match inputs for the truthfulness test.
`Lead` already has a UNIQUE on `conversation_id`, which is what makes the upsert an update.
