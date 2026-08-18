# Spec: Rename brand to Property Advisor

## Goal

Rename the brokerage brand from "Home Advisor" to **Property Advisor** everywhere
it appears — frontend UI, backend agent prompts, page metadata, tests, specs, and
project docs — and at the same time land the pending fix that labels the assistant
**Amaya** in the chat UI instead of the brand name. Also rename the external
services (GitHub, Neon, Vercel) so the deployed surfaces match.

The name change is driven by two problems with "Home Advisor": it collides with
HomeAdvisor.com (Angi's US home-services marketplace) for search and trademark,
and "Home" excludes bare land, which is in scope for this market.

## Acceptance Criteria

### Code — frontend

- [ ] `grep -ri "home advisor\|homeadvisor"` over `frontend/` (excluding
      `node_modules/` and `coverage/`) returns zero matches.
- [ ] [Logo.tsx](../../../frontend/components/layout/Logo.tsx) wordmark reads
      "Property Advisor" and the brand-mark initial is `P`, not `H`.
- [ ] The `aria-hidden` comment in `Logo.tsx` reflects the new initial — it
      currently reasons about announcing `"H Home Advisor"`.
- [ ] `Logo` still has accessible name exactly "Property Advisor" (the initial
      stays hidden from assistive tech; it must not announce "P Property Advisor").
- [ ] [layout.tsx](../../../frontend/app/layout.tsx) metadata title reads
      "Property Advisor — Property in Colombo and across Sri Lanka".
- [ ] [Footer.tsx](../../../frontend/components/layout/Footer.tsx) copyright line
      reads "© 2026 Property Advisor — a UI prototype. All imagery is illustrative."
- [ ] `EMAIL` in `Footer.tsx` is `hello@propertyadvisor.lk`, and the mailto href
      matches the link text.

### Code — chat panel (Amaya)

- [ ] [ChatPanel.tsx](../../../frontend/components/chat/ChatPanel.tsx) header
      reads **"Amaya — AI Advisor"** (not "Property Advisor AI Agent").
- [ ] Conversation list `aria-label` is "Conversation with Amaya".
- [ ] Input `aria-label` is "Ask Amaya".
- [ ] `SPEAKER_LABELS.agent` in [lib/chat.ts](../../../frontend/lib/chat.ts) is
      `"Amaya"`, so transcript turns announce as `Amaya:`.
- [ ] The brand still appears in the header and footer — only the *assistant's*
      label becomes Amaya. Amaya is the advisor, Property Advisor is the brokerage.

### Code — backend

- [x] `grep -ri "home advisor"` over tracked files in `backend/` returns zero
      matches, **with one deliberate exception**: `test_agent_prompts.py`'s
      `test_no_trace_of_the_old_brand` guard. A test asserting the old name is
      absent from `SYSTEM_PROMPT` must necessarily contain that string. Criterion
      amended during verification rather than dropping the guard — the system
      prompt is the one place a stale brand name would reach users without any
      rendered surface to catch it.
- [ ] [prompts.py](../../../backend/app/agent/prompts.py) names the brokerage
      "Property Advisor" in all three places, and the persona guard still reads
      that Amaya works there rather than being named after it.
- [ ] [tools.py](../../../backend/app/agent/tools.py) `search_properties`
      description says "Property Advisor's published property listings".
- [ ] [main.py](../../../backend/app/main.py) `FastAPI(title=...)` is
      "Property Advisor API".

### Tests

- [ ] All brand assertions updated: `page-structure`, `footer`, `chat-panel`,
      `navbar`, `regions` (frontend) and `test_agent_prompts.py` (backend).
- [ ] `test_agent_prompts.py` still guards the persona both ways — asserts
      `"You are Property Advisor"` is absent and `"Property Advisor"` is present.
- [ ] `pnpm build` passes from `frontend/`.
- [ ] `pnpm test` passes from `frontend/`.
- [ ] `uv run pytest` passes from `backend/`.

### Docs

- [ ] [CLAUDE.md](../../../CLAUDE.md) Branding section names Property Advisor as
      the brand, and the note about the frontend still saying "Home Advisor" in
      `lib/chat.ts` / `ChatPanel.tsx` is **deleted** — that pending rename is done
      as part of this chore, so leaving the note would describe a state that no
      longer exists.
- [ ] `context/PROJECT_OVERVIEW.md` uses the new brand wherever it named the old one.
- [ ] Archived specs under `context/features/done/` are updated **only** where the
      brand appears as live product copy an acceptance criterion still checks;
      historical prose in already-archived specs may keep the old name rather than
      rewriting shipped history.

### External services

- [x] GitHub repo renamed to `property-advisor`; local `origin` remote URL updated
      and `git fetch` verified against it. Confirmed done.
- [x] Neon **project** renamed (cosmetic label only). Confirmed done —
      `uv run alembic current` returns `c9432564c721 (head)`, so `DATABASE_URL`
      still resolves and needed no edit.
- [ ] ~~Database and owner role renamed.~~ **Dropped.** The connection string
      already carries both (`neondb_owner` as the role, `/neondb` as the database).
      Renaming them changes `DATABASE_URL` for no user-visible benefit — the
      database name is not part of the brand and appears only in one gitignored
      file. Left as `neondb` / `neondb_owner` deliberately.
- [x] Vercel project renamed and production domain re-pointed. Confirmed done.
      The Vercel OIDC warning shown on rename was informational — the `sub` claim
      embeds the project name, but nothing here uses OIDC federation (Postgres is
      reached with a plain connection string, and the API runs on Render).

## Out of Scope

- **Renaming the local working directory.** Stays `home-advisor` on disk. Three
  absolute paths in `.claude/settings.local.json` reference it, plus IDE workspace
  state; renaming the folder is a separate decision with no product benefit.
- **Render.** Not deployed yet. Its rename and its `ALLOWED_ORIGINS` update are
  captured as a for-later checklist, not done now.
- **Buying or verifying the `propertyadvisor.lk` domain.** The footer email is
  prototype copy; using the address does not assert the domain is registered.
- **Trademark search.** Flagged as worth doing, not part of this chore.
- **Any logo/visual redesign** beyond swapping the `H` glyph for `P`.
- **Renaming Amaya**, or changing her persona, tone, or behaviour rules.
- **Neon project ID, endpoint hostname, or branch names** — the project ID and
  endpoint ID are immutable and unrelated to the brand.

## Edge Cases

- **`navbar.test.tsx` brand-link query.** It uses `/Home Advisor/` with a comment
  explaining that the regex avoids matching the "Home" nav link. Under the new
  name the collision disappears — but the nav still has a "Home" item, so keep the
  query anchored on the full brand string and update the comment to say why it no
  longer needs to disambiguate.
- **Logo accessible name.** `Logo` is rendered in both the navbar and the footer.
  If the `aria-hidden` on the initial is dropped while editing, the accessible
  name silently becomes "P Property Advisor" and `navbar.test.tsx`'s
  `toHaveAccessibleName` catches it. Do not weaken that assertion to make it pass.
- **Neon role rename can invalidate the password.** In Postgres, renaming a role
  clears its password if the verifier was MD5-hashed, because the hash is salted
  with the role name. Neon defaults to SCRAM-SHA-256, which is not username-salted
  and so survives — but verify a connection works *before* discarding the old
  credentials, and be ready to reset the password.
- **A database cannot be renamed while connected to it.** The `ALTER DATABASE`
  must be issued from a different database on the same endpoint.
- **`coverage/coverage-final.json`** has 16 stale matches. It is generated output —
  do not hand-edit; it is overwritten by the next `pnpm test:coverage`.
- **Old GitHub URL keeps working.** GitHub redirects renamed repos, so a stale
  remote will not fail loudly. Update it explicitly rather than relying on the
  redirect.
- **Vercel's old `.vercel.app` URL stops resolving** once the project is renamed.
  Nothing currently points at it (`NEXT_PUBLIC_API_URL` targets the backend, and
  the backend is not deployed), so the blast radius is zero today — but it would
  not be later.

## Notes

### External rename steps

**1. GitHub** — repo is `ashfaqshimer/home-advisor`, remote uses the
`github-personal` SSH host alias.

1. Repo → Settings → General → Repository name → `property-advisor` → Rename.
2. Update the local remote:
   `git remote set-url origin git@github-personal:ashfaqshimer/property-advisor.git`
3. Verify: `git remote -v && git fetch origin`

**2. Neon** — DONE, project label only.

Console → Project → Settings → General → project renamed. The connection string
was unaffected because the host derives from the endpoint ID
(`ep-lucky-cherry-azkynd9i`), not the project name. Verified with
`uv run alembic current` → `c9432564c721 (head)`.

Database and role rename deliberately **not** done; see the acceptance criteria
for why. `DATABASE_URL` keeps `neondb_owner` / `neondb`.

**3. Vercel**

1. Project → Settings → General → Project Name → `property-advisor` → Save.
2. Note the new `property-advisor.vercel.app` URL.
3. Domains tab: if a custom domain is attached, it is unaffected by the rename.
4. No env var changes needed today.

**4. Render** — deferred, not deployed. When it is: rename the service, then set
`ALLOWED_ORIGINS` to the new Vercel URL and `NEXT_PUBLIC_API_URL` in Vercel to the
new Render URL.

### Why the brand changed

Recorded so this is not re-litigated: "Home Advisor" collided with HomeAdvisor.com
(Angi) on search and trademark, and excluded bare land. Vehicles were considered as
a future category and explicitly dropped — scope is land, homes, and apartments —
which is what made "Property" the right umbrella term rather than a category-free
coined name. "Property" is also the standard local term (LankaPropertyWeb, ikman's
property section).

Distinctiveness lives in the Amaya persona, not the brand, which is why a plainly
descriptive brand name is acceptable here.
