# SEO Architecture & Indexation Guide

This document describes the search engine optimization (SEO) architecture, routing hierarchy, structured data implementations, and indexation rules for **Property Advisor**. It is intended as permanent context for developers and autonomous AI agents working on this codebase.

---

## 1. System Overview

Property Advisor operates on a hybrid architecture:
* **Frontend:** Next.js 16 (App Router, Turbopack, Tailwind CSS v4) hosted on Vercel.
* **Backend:** FastAPI (Python 3.11, SQLAlchemy 2.0) hosted on Render.
* **Database:** PostgreSQL on Neon (with SQLite compatibility for local testing).

All public-facing routes are designed to be **crawlable, server-rendered (SSR/SSG), and semantically structured** to capture high-intent organic search traffic across Sri Lanka (Colombo-centric, island-wide reach).

---

## 2. Public Route & URL Hierarchy

| Route | Rendering Mode | Purpose | Structured Data |
|---|---|---|---|
| `/` | Server Component (SSR) | Brand authority, AI hero search, featured listings, FAQ accordion, location map | `RealEstateAgent`, `WebSite`, `FAQPage` |
| `/properties` | Server Component (SSR) | Public catalog hub with real-time keyword/type/price filters | `CollectionPage`, `ItemList` |
| `/properties/[id]` | Server Component (Dynamic) | Dedicated listing view with full specifications, photo gallery, and Amaya inquiry CTA | `RealEstateListing` |
| `/locations/[slug]` | Static Site Generation (SSG) | Programmatic landing pages for 9 core Sri Lankan property hubs | `BreadcrumbList` |
| `/faq` | Server Component (SSR) | Standalone buying guide, foreigner regulations, taxes, and legal procedures | `FAQPage` |
| `/tools/area-converter` | Server Component (SSR) | Interactive Sri Lankan land area utility (Perches ↔ Sq Ft ↔ Acres ↔ Rate estimator) | `WebApplication`, `FAQPage` |
| `/opengraph-image` | Edge Dynamic (ImageResponse) | Auto-generated branded 1200x630 social preview image | Open Graph / Twitter Card |
| `/robots.txt` | Route Handler (`app/robots.ts`) | Allows public routes; blocks `/admin/`, `/login`, `/api/` | Crawler directives |
| `/sitemap.xml` | Route Handler (`app/sitemap.ts`) | Auto-discovers homepage, catalog, locations, tools, FAQ, and database listing IDs | XML Sitemap |

---

## 3. Crawler Control & Privacy Directives

Search engine bots are explicitly prevented from indexing administrative or sensitive internal routes:

1. **Dynamic `robots.ts`** ([`frontend/app/robots.ts`](file:///d:/Code/property-advisor/frontend/app/robots.ts)):
   - Disallows: `/admin/`, `/login`, `/api/`.
   - Allows: `/`.
   - Points directly to `${siteUrl}/sitemap.xml`.
2. **Layout Level Directives**:
   - [`frontend/app/(admin)/layout.tsx`](file:///d:/Code/property-advisor/frontend/app/%28admin%29/layout.tsx): Enforces `robots: { index: false, follow: false, nocache: true }`.
   - [`frontend/app/login/layout.tsx`](file:///d:/Code/property-advisor/frontend/app/login/layout.tsx): Enforces `robots: { index: false, follow: false, nocache: true }`.
3. **Edge Auth Middleware** ([`frontend/proxy.ts`](file:///d:/Code/property-advisor/frontend/proxy.ts)):
   - Unauthenticated bot or user requests to `/admin` or `/admin/*` are 307 redirected to `/login`.

---

## 4. Structured Data Inventory (Schema.org / JSON-LD)

All structured data is embedded as valid `application/ld+json` scripts:

### A. Root Entity: `RealEstateAgent` & `WebSite`
* **File:** [`frontend/components/seo/JsonLd.tsx`](file:///d:/Code/property-advisor/frontend/components/seo/JsonLd.tsx) (rendered in [`frontend/app/layout.tsx`](file:///d:/Code/property-advisor/frontend/app/layout.tsx)).
* **Fields:** Organization name, logo, Colombo coordinates (`6.9271, 79.8612`), address, phone, email, and social profiles dynamically synced with `getSiteConfiguration()`.

### B. Catalog: `CollectionPage` & `ItemList`
* **File:** [`frontend/app/properties/page.tsx`](file:///d:/Code/property-advisor/frontend/app/properties/page.tsx).
* **Fields:** Enumerated `itemListElement` pointing to active property URLs.

### C. Listings: `RealEstateListing`
* **File:** [`frontend/app/properties/[id]/page.tsx`](file:///d:/Code/property-advisor/frontend/app/properties/%5Bid%5D/page.tsx).
* **Fields:** Property title, description, price, currency (`LKR`), availability status, unit rate spec (`MONTH` or `TOTAL`), geo-coordinates, and images.

### D. Programmatic Locations: `BreadcrumbList`
* **File:** [`frontend/app/locations/[slug]/page.tsx`](file:///d:/Code/property-advisor/frontend/app/locations/%5Bslug%5D/page.tsx).
* **Fields:** Breadcrumb trail: `Home` (`1`) → `Locations` (`2`) → `{Location Name}` (`3`).

### E. Real Estate Questions: `FAQPage`
* **Files:** [`frontend/components/home/FaqSection.tsx`](file:///d:/Code/property-advisor/frontend/components/home/FaqSection.tsx), [`frontend/app/faq/page.tsx`](file:///d:/Code/property-advisor/frontend/app/faq/page.tsx), and [`frontend/app/tools/area-converter/page.tsx`](file:///d:/Code/property-advisor/frontend/app/tools/area-converter/page.tsx).
* **Fields:** Direct questions and accepted answers targeting Google collapsible SERP rich snippets.

### F. Tools: `WebApplication`
* **File:** [`frontend/app/tools/area-converter/page.tsx`](file:///d:/Code/property-advisor/frontend/app/tools/area-converter/page.tsx).
* **Fields:** Declares the calculator as a free utility application (`UtilityApplication`).

---

## 5. Programmatic Location Architecture

To expand coverage for long-tail search queries (e.g., *"houses for sale in nugegoda"*, *"apartments in rajagiriya"*), locations are centralized in:

* **Config:** [`frontend/lib/locations.ts`](file:///d:/Code/property-advisor/frontend/lib/locations.ts)
* **Hubs Supported:**
  1. `colombo` (Commercial Capital, Colombo 03, 04, 07)
  2. `rajagiriya` (Parliament corridor & luxury condos)
  3. `nugegoda` (Residential family homes & schools)
  4. `dehiwala` (Marine drive & beachfront properties)
  5. `mount-lavinia` (Seaside villas & beach condos)
  6. `battaramulla` (Administrative hub & gated communities)
  7. `kandy` (Hill country & heritage estates)
  8. `galle` (Southern coastal & UNESCO fort villas)
  9. `negombo` (Airport proximity & lagoon properties)

**Extending Locations:** Adding a new record to the `CITIES` array in [`frontend/lib/locations.ts`](file:///d:/Code/property-advisor/frontend/lib/locations.ts) automatically:
1. Generates a new SSG landing page at build time via `generateStaticParams()`.
2. Adds the URL to `/sitemap.xml`.
3. Populates cross-link recommendations on all other location pages.

---

## 6. Backend Public API Endpoints

The backend provides public endpoints consumed by Next.js during build and runtime:

* `GET /properties/featured?limit=N` — Retrieves up to 50 active listings with price valuation grade annotations.
* `GET /properties/{property_id}` — Public read endpoint in [`backend/app/api/properties.py`](file:///d:/Code/property-advisor/backend/app/api/properties.py). Returns 404 if the property is absent or deleted.
* **Database Safety Rule:** Future agents must never delete or edit production data without explicit user confirmation.

---

## 7. Environment Variables & Production Configuration

The following variables govern canonical URL construction and webmaster verification:

| Variable | Environment | Default / Example | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Production / Preview | `https://propertyadvisor.lk` | Base URL for sitemaps, robots.txt, canonical links, and Open Graph previews |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Production | `e.g. abcd1234efgh` | Automatically renders `<meta name="google-site-verification" content="..." />` |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | Production | `e.g. 5678IJKL` | Automatically renders `<meta name="msvalidate.01" content="..." />` |
| `NEXT_PUBLIC_API_URL` | All | `http://127.0.0.1:8000` (Dev) / `/api` (Prod) | FastAPI backend target |
| `BACKEND_URL` | Production (Vercel) | `https://property-advisor-96sg.onrender.com` | Destination for Next.js `/api/*` reverse proxy rewrites |

---

## 8. Verification & Test Commands

When making modifications touching SEO or routing, run:

```bash
# Frontend test suite (134 tests)
cd frontend
pnpm test

# Full production build test (Turbopack + SSG route verification)
pnpm --filter frontend build

# Backend properties test suite
cd backend
uv run pytest tests/test_properties_featured.py
```
