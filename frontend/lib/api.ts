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

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.reply === "string" && typeof candidate.session_id === "string"
  );
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
