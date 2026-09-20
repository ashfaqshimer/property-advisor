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
property-advisor/
├── frontend/                 # Next.js app
│   ├── app/
│   │   ├── page.tsx           # Homepage (hero, featured properties, chat panel)
│   │   ├── layout.tsx
│   │   ├── login/             # /login page (session-based staff auth)
│   │   └── (admin)/admin/     # Admin dashboard (route group, auth-guarded)
│   │       ├── layout.tsx     # Shared sidebar + header, getCurrentUser guard
│   │       ├── page.tsx       # Properties table
│   │       ├── leads/         # Leads table
│   │       ├── properties/    # Property detail/edit
│   │       └── users/         # User management (root role only)
│   ├── components/
│   │   ├── admin/             # AdminUserMenu, data table layouts
│   │   ├── chat/              # ChatPanel, MessageBubble, PromptChips, ChatInput
│   │   ├── properties/        # PropertyCard, PropertyGrid
│   │   ├── layout/            # Navbar, Footer, Hero
│   │   └── ui/                # Shared primitives (Spinner, ChatCta, …)
│   └── lib/                   # API client (api.ts), types, chat.ts, properties.ts
├── backend/                   # FastAPI app
│   ├── app/
│   │   ├── main.py            # FastAPI entrypoint, structlog middleware, CORS
│   │   ├── api/
│   │   │   ├── auth.py        # POST /auth/login, POST /auth/logout, GET /auth/me
│   │   │   ├── chat.py        # POST /chat endpoint
│   │   │   ├── leads.py       # GET /leads (public + auth-protected admin)
│   │   │   └── properties.py  # GET /properties/featured + admin CRUD
│   │   ├── agent/
│   │   │   ├── loop.py        # Manual tool-calling loop (run_turn)
│   │   │   ├── tools.py       # Tool definitions + implementations
│   │   │   ├── persona.py     # Amaya's voice, objectives, seller/buyer lanes
│   │   │   ├── guardrails.py  # Inventory rules, never-do list
│   │   │   ├── schema_intro.py # Runtime seller fields from PropertyCreate schema
│   │   │   ├── prompt_builder.py # Assembles system prompt from the three modules
│   │   │   ├── prompts.py     # Legacy shim — do not add new prompt logic here
│   │   │   └── client.py      # Gemini API wrapper
│   │   ├── models/            # SQLAlchemy models (property, conversation, message, lead, auth)
│   │   ├── db/                # Session, engine, Alembic config, queries, seed
│   │   └── schemas/           # Pydantic request/response models
│   ├── alembic/
│   └── pyproject.toml         # uv-managed; no requirements.txt
└── README.md
```

---

## 4. Data Models

### `properties`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| title | string(200) | |
| description | text | |
| listing_type | enum | sale, rent |
| price | numeric(14,2) | LKR |
| is_price_per_perch | bool | For land listings priced per perch |
| is_featured | bool | Replaces the "newest-available" heuristic; indexed |
| location | string(120) | e.g. "Colombo 5", "Galle" |
| latitude / longitude | float | nullable; geolocation for future map features |
| property_type | enum | house, apartment, land, commercial |
| bedrooms | int | nullable |
| bathrooms | int | nullable |
| land_size_perches | numeric(8,2) | nullable |
| floor_area_sqft | int | nullable |
| parking_spaces | int | nullable |
| build_year | int | nullable |
| road_access_ft | int | nullable |
| furnishing_status | enum | unfurnished, semi_furnished, fully_furnished; nullable |
| amenities | JSON | nullable; free-form extra features |
| image_urls | array[string] | Postgres ARRAY, SQLite JSON variant for tests |
| image_alt | string | Alt text for image_urls[0]; describes the photo, not the listing |
| status | enum | available, under_offer, sold |
| created_at | timestamp | |

### `leads`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | string | nullable until captured |
| phone | string | nullable until captured |
| budget_min / budget_max | numeric(14,2) | nullable |
| intent | enum | buy, rent, sell; nullable; indexed |
| interest | enum | apartment_sale, apartment_rent, house_sale, house_rent, land, selling, other; nullable |
| source | enum | ai_agent, manual, fallback; nullable |
| requirements | text | free-form needs from the conversation (replaces `preferences`) |
| remarks | text | nullable; brief operational notes for follow-up context |
| edited_by_id | FK → staff_users.id | nullable; SET NULL on staff delete |
| conversation_id | FK → conversations.id | UNIQUE; makes repeat `capture_lead` an update, not a duplicate |
| created_at | timestamp | |
| updated_at | timestamp | Tracks when the last `capture_lead` enrichment happened |

### `conversations`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| session_id | string | client-generated, UNIQUE |
| created_at | timestamp | |

### `messages`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| conversation_id | FK → conversations.id | |
| role | enum | user, assistant, tool |
| content | text | |
| tool_payload | JSON | nullable; stores function_call / function_response parts for replay |
| seq | int | ordering within a conversation (created_at is insufficient — Postgres `now()` is transaction-start time) |
| created_at | timestamp | |

### `staff_users`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| email | string | FastAPI Users standard field, UNIQUE, indexed |
| hashed_password | string | FastAPI Users standard field |
| is_active | bool | FastAPI Users standard field |
| is_superuser | bool | FastAPI Users standard field |
| is_verified | bool | FastAPI Users standard field |
| name | string(120) | |
| role | string(20) | e.g. "root", "agent" |
| created_at | timestamp | |

### `staff_sessions` (Access Tokens)
| Field | Type | Notes |
|---|---|---|
| token | string (PK) | FastAPI Users access token |
| user_id | FK → staff_users.id | CASCADE delete |
| created_at | timestamp | |

### `property_contacts`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| contact_type | enum | owner, broker |
| full_name | string(200) | |
| company_name | string(200) | nullable |
| email | string(254) | nullable |
| notes | text | nullable |
| created_at | timestamp | |

### `property_contact_phones`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| property_contact_id | FK → property_contacts.id | CASCADE delete |
| phone | string(32) | |
| label | string(40) | nullable |
| is_whatsapp | bool | |

### `site_configurations`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| phone_numbers | JSON | |
| contact_email | JSON | |
| whatsapp | JSON | |
| instagram_link | JSON | |
| facebook_link | JSON | |
| x_link | JSON | |
| tiktok_link | JSON | |
| city | JSON | |
| extra_settings | JSON | nullable |

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

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | Smoke-test |
| POST | `/chat` | — | Send a user message + session_id, get back Amaya's reply |
| GET | `/properties/featured` | — | Curated featured set for the homepage grid |
| GET/POST/PUT/DEL | `/properties` | Staff session | Full listing (admin) with optional query params / CRUD |
| GET | `/leads` | Staff session | View captured leads |
| POST | `/auth/jwt/login` | — | Authenticate staff via FastAPI Users, return session token |
| POST | `/auth/jwt/logout` | Staff session | Revoke current session via FastAPI Users |
| GET | `/users/me` | Staff session | Return the current authenticated staff user via FastAPI Users |
| GET/POST/PUT/DEL | `/property-contacts` | Staff session | Manage property owners and brokers |
| GET/PUT | `/site-configuration` | Staff session (PUT) | Retrieve and update site-wide settings |

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

## 9. Build Status (Current State)

**Completed:**
- **Backend foundation & Auth:** FastAPI project structure, SQLAlchemy models, Alembic migrations, database seeding. Fully migrated to **FastAPI Users** for authentication and session management. Added Business Contact (`property_contacts`) and Site Configuration schemas.
- **Agent core:** Gemini API client wrapper using `google-genai` SDK, `search_properties` and `capture_lead` tools, manual tool-calling loop, persistent conversations.
- **API endpoints:** `/chat`, `/properties`, `/leads`, `/property-contacts`, `/site-configuration`, and FastAPI Users `/auth` routes are fully wired and functional.
- **Frontend integration:** Next.js UI integrated with backend APIs, ChatPanel wired, property grid and admin dashboard operational. Added conditional rendering of contact details and site configuration settings management.
- **Data Models:** Added linking of property owner models.

**Pending / Next Steps:**
- Polish and refine UI/UX (error handling, empty states).
- E2E smoke tests and deployment (Vercel + Render).

---

## 10. Open Questions to Resolve During Build
- Do you want basic auth on `/leads` now, or handle that later once you have a reason to check it remotely?
- Should the chat session persist across page reloads (localStorage session_id) or reset each visit?