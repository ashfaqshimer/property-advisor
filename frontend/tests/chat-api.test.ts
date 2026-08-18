import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ChatError,
  REQUEST_TIMEOUT_MS,
  sendChatMessage,
  wakeBackend,
} from "@/lib/api";

/**
 * The backend client, tested against a stubbed `fetch` — the suite makes no network calls.
 *
 * The point of most of this file is the *classification*: the panel has to say different
 * things for "try again" and "this is broken and retrying won't help", so a single generic
 * throw would be a real defect rather than a stylistic one.
 *
 * Responses are hand-rolled objects rather than `new Response(...)` deliberately: whether a
 * WHATWG `Response` is a global under the jsdom environment depends on the runner, and none
 * of these assertions are about that class.
 */

const BASE = "http://127.0.0.1:8000";

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

/** A rejection carrying the `name` the platform would use, which is all we branch on. */
const named = (name: string) => Object.assign(new Error(name), { name });

const stubFetch = (impl: (...args: unknown[]) => unknown) => {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
};

const send = () => sendChatMessage({ sessionId: "session-1", message: "Hello" });

/** Asserts `promise` rejects with a ChatError, and hands it back for further checks. */
const rejectionFrom = async (promise: Promise<unknown>): Promise<ChatError> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ChatError);
    return error as ChatError;
  }
  throw new Error("expected the call to reject, but it resolved");
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BASE);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendChatMessage request", () => {
  it("posts snake_case JSON to /chat", async () => {
    const fetchSpy = stubFetch(async () =>
      jsonResponse(200, { reply: "Hi", session_id: "session-1" }),
    );

    await send();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/chat`);
    expect(init.method).toBe("POST");
    // The wire contract is snake_case; camelCase would be silently rejected as a 422.
    expect(JSON.parse(init.body as string)).toEqual({
      session_id: "session-1",
      message: "Hello",
    });
  });

  it("returns the parsed reply and session id", async () => {
    stubFetch(async () =>
      jsonResponse(200, { reply: "Two beds in Nugegoda.", session_id: "session-1" }),
    );

    await expect(send()).resolves.toEqual({
      reply: "Two beds in Nugegoda.",
      session_id: "session-1",
    });
  });

  it("does not double the slash when the base URL has a trailing one", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", `${BASE}/`);
    const fetchSpy = stubFetch(async () =>
      jsonResponse(200, { reply: "Hi", session_id: "s" }),
    );

    await send();

    expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE}/chat`);
  });

  it("always attaches an abort signal, so no request can hang forever", async () => {
    const fetchSpy = stubFetch(async () =>
      jsonResponse(200, { reply: "Hi", session_id: "s" }),
    );

    await send();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // The value itself is the measured worst case; this guards it against an idle "tidy-up".
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });
});

describe("missing configuration", () => {
  it("names the variable instead of fetching undefined/chat", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchSpy = stubFetch(async () => jsonResponse(200, {}));

    const error = await rejectionFrom(send());

    expect(error.kind).toBe("config");
    expect(error.message).toContain("NEXT_PUBLIC_API_URL");
    // The whole point: no request is attempted against a nonsense URL.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only value as missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "   ");
    stubFetch(async () => jsonResponse(200, {}));

    expect((await rejectionFrom(send())).kind).toBe("config");
  });

  it("is not retryable — the same request would fail identically", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    stubFetch(async () => jsonResponse(200, {}));

    expect((await rejectionFrom(send())).retryable).toBe(false);
  });
});

describe("error classification", () => {
  it("maps 502 to a retryable upstream failure", async () => {
    stubFetch(async () => jsonResponse(502, { detail: "upstream" }));

    const error = await rejectionFrom(send());
    expect(error.kind).toBe("upstream");
    expect(error.status).toBe(502);
    expect(error.retryable).toBe(true);
  });

  it("maps 503 to an unavailable backend that retrying cannot fix", async () => {
    stubFetch(async () => jsonResponse(503, { detail: "no key" }));

    const error = await rejectionFrom(send());
    expect(error.kind).toBe("unavailable");
    expect(error.status).toBe(503);
    // A missing GEMINI_API_KEY is a deployment fault. Offering "try again" would be a lie.
    expect(error.retryable).toBe(false);
  });

  it("treats a 422 as our own bug, not a user error", async () => {
    stubFetch(async () => jsonResponse(422, { detail: [] }));

    // The input mirrors the backend's limits, so a 422 means the two have drifted.
    expect((await rejectionFrom(send())).kind).toBe("unexpected");
  });

  it("classifies an unlisted status rather than assuming a shape", async () => {
    stubFetch(async () => jsonResponse(500, {}));

    const error = await rejectionFrom(send());
    expect(error.kind).toBe("unexpected");
    expect(error.status).toBe(500);
  });

  it("maps a timeout to its own kind, not to a generic network failure", async () => {
    stubFetch(async () => {
      throw named("TimeoutError");
    });

    const error = await rejectionFrom(send());
    expect(error.kind).toBe("timeout");
    expect(error.retryable).toBe(true);
  });

  it("maps a rejected fetch to a network failure without claiming a cause", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await rejectionFrom(send());
    expect(error.kind).toBe("network");
    expect(error.retryable).toBe(true);
    // Offline, DNS, and CORS are indistinguishable here — the copy must not pick one.
    expect(error.message).not.toMatch(/CORS|offline|connection/i);
  });

  it("rejects a malformed body", async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("not json");
      },
    }));

    expect((await rejectionFrom(send())).kind).toBe("unexpected");
  });

  it("rejects a 200 that isn't the shape we asked for", async () => {
    stubFetch(async () => jsonResponse(200, { message: "wrong field" }));

    // Better a named error than `undefined` rendered into a bubble as Amaya's reply.
    expect((await rejectionFrom(send())).kind).toBe("unexpected");
  });
});

describe("caller cancellation", () => {
  it("propagates the original abort rather than reporting a failure", async () => {
    const controller = new AbortController();
    stubFetch(async () => {
      controller.abort();
      throw named("AbortError");
    });

    let caught: unknown;
    try {
      await sendChatMessage({
        sessionId: "s",
        message: "Hello",
        signal: controller.signal,
      });
    } catch (error) {
      caught = error;
    }

    // An unmounting panel is not an error state, so this must stay distinguishable from
    // a timeout — which aborts with the same machinery but nobody asked for.
    expect(caught).not.toBeInstanceOf(ChatError);
    expect((caught as Error).name).toBe("AbortError");
  });

  it("still reports a timeout when the caller did not abort", async () => {
    const controller = new AbortController();
    stubFetch(async () => {
      throw named("AbortError");
    });

    const error = await rejectionFrom(
      sendChatMessage({ sessionId: "s", message: "Hello", signal: controller.signal }),
    );
    expect(error.kind).toBe("timeout");
  });
});

describe("wakeBackend", () => {
  it("gets /health so the visitor's first message skips the cold start", () => {
    const fetchSpy = stubFetch(async () => jsonResponse(200, { status: "ok" }));

    wakeBackend();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/health`);
    expect(init.method).toBe("GET");
  });

  it("swallows a failure — nothing on the page depends on it", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    // An unhandled rejection here would surface in the console as a bug that isn't one.
    expect(() => wakeBackend()).not.toThrow();
    await Promise.resolve();
  });

  it("does nothing at all when the base URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchSpy = stubFetch(async () => jsonResponse(200, {}));

    // The first real send is what reports the misconfiguration; this stays quiet.
    expect(() => wakeBackend()).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
