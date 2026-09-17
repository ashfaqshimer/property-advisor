# Project Specification: Real Estate AI Agent Platform

## 1. Overview

A real estate brokerage website centered on an AI agent that chats with prospective buyers/renters, understands their budget and preferences, recommends matching properties from a live database, and captures lead information for follow-up. The site is Colombo-focused but built to signal island-wide reach.

**Primary goals:**
- A real, usable tool for early-stage brokerage work (lead capture + property matching)
- Demonstrates strong agentic AI engineering: a manually built tool-calling loop (no LangChain/LangGraph in v1), clean separation of concerns, and a real database-backed agent rather than a scripted demo
- Mobile-first approach: The application must be a mobile-first application. When developing UI, the primary focus should be the mobile view, ensuring everything is presented properly before scaling up to larger screens.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript, Tailwind CSS) | SEO-friendly, reuses the v0-generated UI |
| Backend | FastAPI (Python) | Standalone service, hosts the agent + REST API |
| Database | PostgreSQL via Neon | Serverless Postgres, generous free tier |
| ORM | SQLAlchemy + Alembic | Migrations for `properties`, `leads`, `conversations`, `messages` |
| LLM | Google Gemini via AI Studio — `gemini-3.1-flash-lite`, using the `google-genai` Python SDK | Cheapest tier; cost-efficient for continuous chat + tool calling |
| Agent architecture | Hand-rolled tool-calling loop (raw Gemini API, no agent framework) | v1 goal: demonstrate manual orchestration. LangGraph migration can be a documented v2 |
| Frontend hosting | Vercel | Native Next.js support, generous free tier |
| Backend hosting | Render | Free tier: 750 hrs/month web service (spins down when idle) |
| Repo structure | Monorepo | `/frontend` and `/backend` in one repo, deployed independently |

---

## 3. Repository Structure

```
real-estate-agent/
├── frontend/                 # Next.js app
│   ├── app/
│   │   ├── page.tsx           # Homepage (hero, featured properties, chat panel)
│   │   ├── layout.tsx
│   │   └── api/               # Next.js route handlers (thin proxy to FastAPI, if needed)
│   ├── components/
│   │   ├── chat/              # ChatPanel, MessageBubble, PromptChips, ChatInput
│   │   ├── properties/        # PropertyCard, PropertyGrid
│   │   └── layout/            # Navbar, Footer, Hero
│   ├── lib/                    # API client, types
│   └── ...
├── backend/                   # FastAPI app
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint
│   │   ├── api/
│   │   │   ├── chat.py         # POST /chat endpoint
│   │   │   └── properties.py   # GET /properties (for the featured grid, optional)
│   │   ├── agent/
│   │   │   ├── loop.py         # Manual tool-calling loop
│   │   │   ├── tools.py        # Tool definitions + implementations
│   │   │   ├── prompts.py      # System prompt(s)
│   │   │   └── client.py       # Gemini API wrapper
│   │   ├── models/             # SQLAlchemy models
│   │   ├── db/                 # Session, engine, Alembic config
│   │   └── schemas/            # Pydantic request/response models
│   ├── alembic/
│   └── requirements.txt
└── README.md
```

---

## 4. Data Models

### `properties`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| title | string | |
| description | text | |
| price | numeric | LKR |
| location | string | e.g. "Colombo 5", "Galle" |
| property_type | enum | house, apartment, land, commercial |
| bedrooms | int | nullable |
| bathrooms | int | nullable |
| sqft | int | nullable |
| image_urls | array[string] | |
| status | enum | available, under_offer, sold |
| created_at | timestamp | |

### `leads`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | string | nullable until captured |
| phone | string | nullable until captured |
| budget_min / budget_max | numeric | nullable |
| preferences | text | free-form notes from conversation |
| conversation_id | FK → conversations.id | |
| created_at | timestamp | |

### `conversations`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| session_id | string | client-generated, ties to a browser session |
| created_at | timestamp | |

### `messages`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| conversation_id | FK → conversations.id | |
| role | enum | user, assistant, tool |
| content | text | |
| created_at | timestamp | |

---

## 5. Agent Design

### Tools (manually defined as `FunctionDeclaration`s, passed via `GenerateContentConfig(tools=[...])`)

1. **`search_properties`**
   - Params: `location` (optional), `budget_min`, `budget_max`, `property_type`, `bedrooms` (optional)
   - Queries the `properties` table, returns up to 5 matches
   - Used whenever the user gives enough criteria to narrow a search

2. **`capture_lead`**
   - Params: `name`, `phone`, `budget_min`, `budget_max`, `preferences`
   - Writes/updates a row in `leads`, linked to the current `conversation_id`
   - Called opportunistically when the agent has gathered enough info — not forced on the user turn one

3. **`get_property_details`** (optional, nice-to-have)
   - Params: `property_id`
   - Returns full details for deep-dive follow-up questions

### Agent loop (manual, no framework)
1. Receive user message → append to `messages`
2. Send full conversation history (as `Content` parts) + tool declarations + system instruction to Gemini
3. If the response contains a `function_call` part: execute the corresponding Python function, append the model's `function_call` turn plus a `function_response` part back into the contents list, and call Gemini again
4. Repeat until Gemini returns a plain text response

**Note:** Cap the loop (e.g. 5 iterations) so a model that keeps re-calling a tool can't spin. `flash-lite` is the cheapest tier in its generation; if it proves unreliable at chaining `search_properties` → `capture_lead` across a conversation, the non-lite Flash model of the same generation is a drop-in upgrade — only the model string changes.
5. Persist the final assistant message, return it to the frontend

### System prompt guidance
- Establish persona: a knowledgeable, friendly Colombo-based agent with reach across Sri Lanka
- Instruct the model to ask clarifying questions (budget, location, property type) before calling `search_properties`
- Instruct the model to naturally work toward capturing name/phone once the conversation has enough substance — never demand it upfront
- Keep responses concise and conversational, not listy/robotic

---

## 6. API Endpoints (FastAPI)

| Method | Path | Purpose |
|---|---|---|
| POST | `/chat` | Send a user message + session_id, get back the agent's reply (runs the full tool loop) |
| GET | `/properties/featured` | Returns a curated set of properties for the homepage grid |
| GET | `/properties` | Full listing with optional query params (for a future listings page) |
| GET | `/leads` | (Auth-protected, for your own use) view captured leads |

---

## 7. Environment Variables

**Backend (`.env`)**
```
DATABASE_URL=postgresql://...neon connection string...
GEMINI_API_KEY=...AI Studio key...
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

**Frontend (`.env.local`)**
```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## 8. Deployment

- **Frontend:** Vercel, connected to `/frontend` in the monorepo
- **Backend:** Render web service, connected to `/backend`, free tier (note: spins down after inactivity — acceptable for early-stage/demo use)
- **Database:** Neon free tier Postgres, connection string shared with the Render service

---

## 9. Suggested Build Phases (for Claude Code)

**Phase 1 — Backend foundation**
- Set up FastAPI project structure, SQLAlchemy models, Alembic migrations
- Seed the `properties` table with realistic sample data (6-9 properties matching the UI mockup)

**Phase 2 — Agent core**
- Implement the Gemini API client wrapper (`google-genai` SDK)
- Implement `search_properties` and `capture_lead` tools
- Build the manual tool-calling loop
- Test via a simple script or FastAPI docs (`/docs`) before wiring up the frontend

**Phase 3 — Chat API**
- Build `/chat` endpoint tying conversation persistence + agent loop together
- Build `/properties/featured` endpoint

**Phase 4 — Frontend integration**
- Port the v0-generated UI into the Next.js app structure
- Wire the ChatPanel component to `/chat`
- Wire the featured properties grid to `/properties/featured`

**Phase 5 — Polish & deploy**
- Error handling, loading states, empty states
- Deploy frontend to Vercel, backend to Render, verify env vars and CORS
- Smoke test the full conversation flow end-to-end

---

## 10. Open Questions to Resolve During Build
- Do you want basic auth on `/leads` now, or handle that later once you have a reason to check it remotely?
- Should the chat session persist across page reloads (localStorage session_id) or reset each visit?