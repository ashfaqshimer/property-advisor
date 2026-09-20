/**
 * The only place the browser talks to the FastAPI backend.
 *
 * Two things here are load-bearing and easy to undo by accident:
 *
 * **`process.env.NEXT_PUBLIC_API_URL` is written out literally, every time.** Next inlines
 * `NEXT_PUBLIC_*` references into the client bundle at *build* time by textual
 * substitution, so any indirection — `process.env[name]`, or destructuring `process.env`
 * first — silently yields `undefined` in the browser while still type-checking and still
 * working under Node in the test suite. The Next 16 env-var guide spells this out.
 *
 * **Failures are classified, not merged into one throw.** The panel has to say different
 * things for "try that again" and "this is broken and retrying won't help", so every exit
 * from here is a `ChatError` carrying a `kind`. The user-facing wording is deliberately
 * *not* here — it lives with the panel that renders it; these messages are diagnostic.
 */

/** Named in the error message rather than interpolated from the literal above. */
const BASE_URL_VAR = "NEXT_PUBLIC_API_URL";

/**
 * Chosen against a measured worst case, not picked round.
 *
 * The spec set this at 45s from an assumed ~30s ceiling (a ~22s cold start plus a 4–11s
 * model call). Measuring the deployed backend on 2026-08-19 found warm turns of **3.2s,
 * 16.4s and 30.4s** — the slowest being one that ran `search_properties`, so two model calls.
 * A cold start on top of a turn like that clears 45s, and aborting a request that was going
 * to succeed is the worst outcome available here. Hence 60s.
 *
 * `wakeBackend()` is what keeps this from being the common case rather than the rule.
 */
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Mirrors `MAX_MESSAGE_LENGTH` in `backend/app/schemas/chat.py`. The input caps itself at
 * this so the server's 422 is unreachable through the UI — if one ever arrives, the two
 * numbers have drifted, which is why a 422 is classified as `unexpected` below.
 */
export const MAX_MESSAGE_LENGTH = 2000;

export type ChatErrorKind =
  /** `NEXT_PUBLIC_API_URL` is missing — a deployment mistake, not a user one. */
  | "config"
  /** The request outlived REQUEST_TIMEOUT_MS. */
  | "timeout"
  /** `fetch` itself rejected: offline, DNS, or a CORS rejection. Cause unknowable. */
  | "network"
  /** 502 — Gemini transport, quota, or upstream error. The backend does not retry. */
  | "upstream"
  /** 503 — `GEMINI_API_KEY` is unset on the server. Retrying is pointless. */
  | "unavailable"
  /** Anything else, including a 422, which would be a bug in our own validation. */
  | "unexpected";

export class ChatError extends Error {
  readonly kind: ChatErrorKind;
  readonly status: number | null;

  constructor(kind: ChatErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "ChatError";
    this.kind = kind;
    this.status = status;
  }

  /**
   * Whether offering the user a retry button is honest. A 503 and a missing base URL are
   * both server-side faults that the same request will hit again.
   */
  get retryable(): boolean {
    return this.kind === "timeout" || this.kind === "network" || this.kind === "upstream";
  }
}

/** The wire shape of a successful `POST /chat`, snake_case as the API sends it. */
export type ChatResponse = {
  reply: string;
  session_id: string;
};

export type FallbackLeadPayload = {
  sessionId: string;
  name: string;
  phone: string;
};

export type PropertyContactPhone = {
  id: string;
  phone: string;
  label: string | null;
  is_whatsapp: boolean;
};

export type PropertyContact = {
  id: string;
  contact_type: "owner" | "broker";
  full_name: string;
  company_name: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  phones: PropertyContactPhone[];
};

export type PropertyApiRecord = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: "LKR";
  listing_type: "sale" | "rent";
  is_price_per_perch: boolean;
  is_featured: boolean;
  location: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  land_size_perches: number | null;
  floor_area_sqft: number | null;
  parking_spaces: number | null;
  build_year: number | null;
  road_access_ft: number | null;
  furnishing_status: string | null;
  amenities: Record<string, boolean> | null;
  image_urls: string[];
  image_alt: string;
  status: string;
  created_at: string;
  property_contact_id: string | null;
  property_contact: PropertyContact | null;
};

export type CreatePropertyPayload = {
  title: string;
  description: string;
  listing_type: "sale" | "rent";
  price: number;
  is_price_per_perch?: boolean;
  location: string;
  property_type: "house" | "apartment" | "land" | "commercial";
  bedrooms: number | null;
  bathrooms: number | null;
  land_size_perches?: number | null;
  floor_area_sqft: number | null;
  parking_spaces?: number | null;
  build_year?: number | null;
  road_access_ft?: number | null;
  furnishing_status?: string | null;
  amenities?: Record<string, boolean> | null;
  image_urls: string[];
  image_alt: string;
  status: "available" | "under_offer" | "sold";
  is_featured?: boolean;
};

export type AdminPropertyUpdatePayload = Partial<CreatePropertyPayload> & {
  is_price_per_perch?: boolean;
  land_size_perches?: number | null;
  parking_spaces?: number | null;
  build_year?: number | null;
  road_access_ft?: number | null;
  furnishing_status?: "unfurnished" | "semi_furnished" | "fully_furnished" | null;
  amenities?: Record<string, boolean> | null;
  property_contact_id?: string | null;
};

export type LeadSource = "ai_agent" | "manual" | "fallback";
export type LeadInterest =
  | "apartment_sale"
  | "apartment_rent"
  | "house_sale"
  | "house_rent"
  | "land"
  | "selling"
  | "other";

export type ManualLeadPayload = {
  name?: string;
  phone: string;
  budget_min?: number;
  budget_max?: number;
  intent?: "buy" | "rent" | "sell";
  requirements?: string;
  interest?: LeadInterest;
  remarks?: string;
  conversation_id?: string;
};

export type AdminLead = {
  id: string;
  name: string | null;
  phone: string | null;
  budget_min: number | null;
  budget_max: number | null;
  intent: "buy" | "rent" | "sell" | null;
  source: LeadSource | null;
  edited_by: { id: string; name: string; email: string } | null;
  requirements: string | null;
  interest: LeadInterest | null;
  remarks: string | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "root" | "agent";
  created_at: string;
};

export type StaffUser = AuthUser & { is_active: boolean };

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

async function parseAuthError(response: Response): Promise<never> {
  let detail = "Authentication failed.";
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") {
      if (payload.detail === "LOGIN_BAD_CREDENTIALS") {
        detail = "Invalid email or password.";
      } else {
        detail = payload.detail;
      }
    }
  } catch {
    // Keep the stable fallback for an empty or malformed error response.
  }
  throw new AuthError(detail, response.status);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);

  const response = await fetch(`${baseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    credentials: "include",
    body,
  });
  if (!response.ok) return parseAuthError(response);
  
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Failed to fetch user details after login.", 401);
  return user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${baseUrl()}/auth/me`, {
    method: "GET",
    credentials: "include",
  });
  if (response.status === 401) return null;
  if (!response.ok) return parseAuthError(response);
  return (await response.json()) as AuthUser;
}

export async function updateProfile(name: string): Promise<AuthUser> {
  const response = await fetch(`${baseUrl()}/auth/me`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Profile update failed (${response.status}).`, response.status);
  return (await response.json()) as AuthUser;
}


export async function changePassword(current_password: string, new_password: string): Promise<void> {
  const response = await fetch(`${baseUrl()}/auth/me/password`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password, new_password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      let detail = "Authentication failed.";
      try {
        const payload = (await response.json()) as { detail?: unknown };
        if (typeof payload.detail === "string") detail = payload.detail;
      } catch {}
      throw new ChatError("unexpected", detail, response.status);
    }
    throw new ChatError("unexpected", `Password change failed (${response.status}).`, response.status);
  }
}


export async function getStaffUsers(): Promise<StaffUser[]> {
  const response = await fetch(`${baseUrl()}/admin/users`, {
    method: "GET",
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `User list failed (${response.status}).`, response.status);
  const result: unknown = await response.json();
  if (!Array.isArray(result)) throw new ChatError("unexpected", "The backend returned an unrecognised user list.");
  return result as StaffUser[];
}

export async function createAgent(name: string, email: string, password: string): Promise<StaffUser> {
  const response = await fetch(`${baseUrl()}/admin/users`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Agent creation failed (${response.status}).`, response.status);
  return (await response.json()) as StaffUser;
}

export async function updateAgent(userId: string, payload: { email?: string; password?: string; is_active?: boolean }): Promise<StaffUser> {
  const response = await fetch(`${baseUrl()}/admin/users/${userId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Agent update failed (${response.status}).`, response.status);
  return (await response.json()) as StaffUser;
}

export type AdminLeadUpdatePayload = Partial<{
  name: string | null;
  phone: string | null;
  budget_min: number | null;
  budget_max: number | null;
  intent: "buy" | "rent" | "sell" | null;
  requirements: string | null;
  interest: LeadInterest | null;
  remarks: string | null;
}>;

export async function updateAdminLead(leadId: string, payload: AdminLeadUpdatePayload): Promise<AdminLead> {
  const response = await fetch(`${baseUrl()}/admin/leads/${leadId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Lead update failed (${response.status}).`, response.status);
  return (await response.json()) as AdminLead;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${baseUrl()}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) return parseAuthError(response);
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.reply === "string" && typeof candidate.session_id === "string"
  );
}

function isPropertyApiRecord(value: unknown): value is PropertyApiRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.price === "number" &&
    candidate.currency === "LKR" &&
    (candidate.listing_type === "sale" || candidate.listing_type === "rent") &&
    typeof candidate.is_price_per_perch === "boolean" &&
    typeof candidate.is_featured === "boolean" &&
    typeof candidate.location === "string" &&
    typeof candidate.property_type === "string" &&
    (typeof candidate.bedrooms === "number" || candidate.bedrooms === null) &&
    (typeof candidate.bathrooms === "number" || candidate.bathrooms === null) &&
    (typeof candidate.land_size_perches === "number" || candidate.land_size_perches === null) &&
    (typeof candidate.floor_area_sqft === "number" || candidate.floor_area_sqft === null) &&
    (typeof candidate.parking_spaces === "number" || candidate.parking_spaces === null) &&
    (typeof candidate.build_year === "number" || candidate.build_year === null) &&
    (typeof candidate.road_access_ft === "number" || candidate.road_access_ft === null) &&
    (typeof candidate.furnishing_status === "string" || candidate.furnishing_status === null) &&
    (typeof candidate.amenities === "object" || candidate.amenities === null) &&
    Array.isArray(candidate.image_urls) &&
    candidate.image_urls.every((url) => typeof url === "string") &&
    typeof candidate.image_alt === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.created_at === "string" &&
    (typeof candidate.property_contact_id === "string" || candidate.property_contact_id === null)
  );
}

function isPropertyApiResponse(value: unknown): value is PropertyApiRecord[] {
  return Array.isArray(value) && value.every(isPropertyApiRecord);
}

/**
 * The backend origin, without a trailing slash.
 *
 * Throws rather than returning a default: fetching `undefined/chat` would surface as an
 * inscrutable network error, and a localhost fallback would look fine in development and
 * fail only in production.
 */
function baseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) {
    throw new ChatError(
      "config",
      `${BASE_URL_VAR} is not set. Point it at the backend origin — ` +
        "http://127.0.0.1:8000 for local development.",
    );
  }
  return configured.replace(/\/+$/, "");
}

/**
 * Turn a rejected `fetch` into a classified error.
 *
 * A caller abort (an unmounting panel) is *not* an application error, so the original
 * `AbortError` propagates untouched for the caller to recognise and ignore. A timeout
 * arrives as a `TimeoutError` because that is the reason `AbortSignal.timeout` aborts with.
 */
function classifyTransportFailure(error: unknown, callerSignal?: AbortSignal): unknown {
  if (callerSignal?.aborted) return error;

  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new ChatError(
      "timeout",
      `No response within ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s.`,
    );
  }

  // Offline, DNS failure, and a CORS rejection are indistinguishable from here by design —
  // the browser withholds the reason. Copy built on this must not claim to know the cause.
  return new ChatError(
    "network",
    "Could not reach the backend. The browser does not say why.",
  );
}

function classifyStatus(status: number): ChatError {
  switch (status) {
    case 502:
      return new ChatError("upstream", "The model call failed upstream.", status);
    case 503:
      return new ChatError(
        "unavailable",
        "The backend is missing its GEMINI_API_KEY.",
        status,
      );
    default:
      // 422 lands here on purpose: the panel mirrors the backend's own limits, so a
      // rejection means our validation drifted from the server's, which is a bug.
      return new ChatError("unexpected", `Unexpected response status ${status}.`, status);
  }
}

/**
 * Send one turn and wait for Amaya's complete reply. There is no streaming — one request,
 * one whole answer.
 *
 * `signal` is for the caller's own cancellation (an unmount); the timeout is added on top,
 * so the request ends at whichever fires first.
 */
export async function sendChatMessage({
  sessionId,
  message,
  signal,
}: {
  sessionId: string;
  message: string;
  signal?: AbortSignal;
}): Promise<ChatResponse> {
  const url = `${baseUrl()}/chat`;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    throw classifyTransportFailure(error, signal);
  }

  if (!response.ok) {
    throw classifyStatus(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatError("unexpected", "The backend returned a malformed body.");
  }

  if (!isChatResponse(payload)) {
    throw new ChatError("unexpected", "The backend returned an unrecognised body.");
  }

  return payload;
}

export async function captureFallbackLead({
  sessionId,
  name,
  phone,
}: FallbackLeadPayload): Promise<void> {
  const response = await fetch(`${baseUrl()}/leads/fallback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, name: name.trim() || null, phone: phone.trim() }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new ChatError("unexpected", `Fallback lead capture failed (${response.status}).`, response.status);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as { captured?: unknown }).captured !== true
  ) {
    throw new ChatError("unexpected", "The backend returned an unrecognised lead response.");
  }
}

export async function getFeaturedProperties(): Promise<PropertyApiRecord[]> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/properties/featured`, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw classifyTransportFailure(error);
  }

  if (!response.ok) {
    throw classifyStatus(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatError("unexpected", "The backend returned a malformed body.");
  }

  if (!isPropertyApiResponse(payload)) {
    throw new ChatError("unexpected", "The backend returned an unrecognised body.");
  }

  return payload;
}

export async function uploadPropertyImages(files: File[]): Promise<string[]> {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  const response = await fetch(`${baseUrl()}/properties/images`, {
    method: "POST",
    credentials: "include",
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Image upload failed (${response.status}).`, response.status);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.every((url) => typeof url === "string")) {
    throw new ChatError("unexpected", "The backend returned an unrecognised image response.");
  }
  return payload;
}

export async function createProperty(payload: CreatePropertyPayload): Promise<PropertyApiRecord> {
  const response = await fetch(`${baseUrl()}/admin/properties`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Property creation failed (${response.status}).`, response.status);
  const result: unknown = await response.json();
  if (!isPropertyApiRecord(result)) {
    throw new ChatError("unexpected", "The backend returned an unrecognised property response.");
  }
  return result;
}

export async function getAdminProperties(): Promise<PropertyApiRecord[]> {
  const response = await fetch(`${baseUrl()}/admin/properties`, {
    method: "GET",
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Property list failed (${response.status}).`, response.status);
  const result: unknown = await response.json();
  if (!isPropertyApiResponse(result)) {
    throw new ChatError("unexpected", "The backend returned an unrecognised property list.");
  }
  return result;
}

export async function updateAdminProperty(
  propertyId: string,
  payload: AdminPropertyUpdatePayload,
): Promise<PropertyApiRecord> {
  const response = await fetch(`${baseUrl()}/admin/properties/${propertyId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Property update failed (${response.status}).`, response.status);
  const result: unknown = await response.json();
  if (!isPropertyApiRecord(result)) {
    throw new ChatError("unexpected", "The backend returned an unrecognised property response.");
  }
  return result;
}

export async function deleteAdminProperty(propertyId: string): Promise<void> {
  const response = await fetch(`${baseUrl()}/admin/properties/${propertyId}`, {
    method: "DELETE",
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Property deletion failed (${response.status}).`, response.status);
}

function isAdminLead(value: unknown): value is AdminLead {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    (typeof candidate.name === "string" || candidate.name === null) &&
    (typeof candidate.phone === "string" || candidate.phone === null) &&
    (typeof candidate.budget_min === "number" || candidate.budget_min === null) &&
    (typeof candidate.budget_max === "number" || candidate.budget_max === null) &&
    (candidate.intent === "buy" || candidate.intent === "rent" || candidate.intent === "sell" || candidate.intent === null) &&
    (candidate.source === "ai_agent" || candidate.source === "manual" || candidate.source === "fallback" || candidate.source === null) &&
    (typeof candidate.requirements === "string" || candidate.requirements === null) &&
    (candidate.interest === "apartment_sale" || candidate.interest === "apartment_rent" || candidate.interest === "house_sale" || candidate.interest === "house_rent" || candidate.interest === "land" || candidate.interest === "selling" || candidate.interest === "other" || candidate.interest === null) &&
    (typeof candidate.remarks === "string" || candidate.remarks === null) &&
    (typeof candidate.conversation_id === "string" || candidate.conversation_id === null) &&
    typeof candidate.created_at === "string" &&
    typeof candidate.updated_at === "string"
  );
}

export async function getAdminLeads(): Promise<AdminLead[]> {
  const response = await fetch(`${baseUrl()}/admin/leads`, {
    method: "GET",
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Lead list failed (${response.status}).`, response.status);
  const result: unknown = await response.json();
  if (!Array.isArray(result) || !result.every(isAdminLead)) {
    throw new ChatError("unexpected", "The backend returned an unrecognised lead list.");
  }
  return result;
}

export async function createAdminLead(payload: ManualLeadPayload): Promise<AdminLead> {
  const response = await fetch(`${baseUrl()}/admin/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Lead creation failed (${response.status}).`, response.status);
  const result: unknown = await response.json();
  if (!isAdminLead(result)) {
    throw new ChatError("unexpected", "The backend returned an unrecognised lead.");
  }
  return result;
}

/**
 * Nudge the Render service awake, and don't wait around for it.
 *
 * The free tier spins down when idle, so a visitor's first message would otherwise pay a
 * ~22s cold start on top of the model call. Calling this as the panel mounts spends that
 * time while they read the page instead.
 *
 * Every failure is swallowed: nothing about the page depends on it, a missing base URL will
 * be reported properly by the first real send, and an unhandled rejection here would show
 * up in the console as a bug that isn't one.
 */
export type CreatePropertyContactPayload = {
  contact_type: "owner" | "broker";
  full_name: string;
  company_name?: string | null;
  email?: string | null;
  notes?: string | null;
  phones: { phone: string; label?: string | null; is_whatsapp?: boolean }[];
};

export type UpdatePropertyContactPayload = Partial<CreatePropertyContactPayload>;

export async function getPropertyContacts(): Promise<PropertyContact[]> {
  const response = await fetch(`${baseUrl()}/admin/property-contacts`, {
    method: "GET",
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Contact list failed (${response.status}).`, response.status);
  return (await response.json()) as PropertyContact[];
}

export async function createPropertyContact(
  payload: CreatePropertyContactPayload,
): Promise<PropertyContact> {
  const response = await fetch(`${baseUrl()}/admin/property-contacts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Contact creation failed (${response.status}).`, response.status);
  return (await response.json()) as PropertyContact;
}

export async function updatePropertyContact(
  contactId: string,
  payload: UpdatePropertyContactPayload,
): Promise<PropertyContact> {
  const response = await fetch(`${baseUrl()}/admin/property-contacts/${contactId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Contact update failed (${response.status}).`, response.status);
  return (await response.json()) as PropertyContact;
}

export async function deletePropertyContact(contactId: string): Promise<void> {
  const response = await fetch(`${baseUrl()}/admin/property-contacts/${contactId}`, {
    method: "DELETE",
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ChatError("unexpected", `Contact deletion failed (${response.status}).`, response.status);
}

/**
 * Nudge the Render service awake, and don't wait around for it.
 *
 * The free tier spins down when idle, so a visitor's first message would otherwise pay a
 * ~22s cold start on top of the model call. Calling this as the panel mounts spends that
 * time while they read the page instead.
 *
 * Every failure is swallowed: nothing about the page depends on it, a missing base URL will
 * be reported properly by the first real send, and an unhandled rejection here would show
 * up in the console as a bug that isn't one.
 */
export function wakeBackend(): void {
  try {
    void fetch(`${baseUrl()}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => {});
  } catch {
    // baseUrl() threw: there is nothing to wake.
  }
}
