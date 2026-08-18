import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatPanel from "@/components/chat/ChatPanel";
import {
  AGENT_STATUS_LINE,
  ERROR_COPY,
  GREETING,
  PENDING_LABEL,
  SLOW_PENDING_AFTER_MS,
  SLOW_PENDING_LABEL,
  SUGGESTION_CHIPS,
} from "@/lib/chat";

/**
 * The panel, now that it talks to `POST /chat`. `fetch` is stubbed throughout — the suite
 * makes no network calls, and every response shape below is chosen by the test.
 *
 * Two limits of this environment are worth stating, because they change what these tests can
 * honestly claim:
 *
 * **jsdom does not implement implicit form submission**, so pressing Enter in the input fires
 * no submit event no matter how the key is dispatched (verified directly against jsdom 30).
 * The tests below therefore submit the form, which is the same code path the browser reaches
 * on Enter, and assert the structure that makes Enter work at all — an `<input>` inside a
 * `<form>` with a `type="submit"` button. That Enter genuinely sends is browser-verified.
 *
 * **jsdom has no layout engine and applies no Tailwind**, so scroll-into-view, the typing
 * animation, the sticky panel, and bubble wrapping are all browser checks. Class assertions
 * here are deletion guards for `@theme` tokens, not proof that anything renders.
 */

const BASE = "http://127.0.0.1:8000";

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

const reply = (text: string) => jsonResponse(200, { reply: text, session_id: "s" });

type ChatHandler = (init: RequestInit) => unknown;

let fetchSpy: ReturnType<typeof vi.fn>;

/**
 * Stubs `fetch` for both endpoints the panel touches. `/health` is answered automatically
 * because the panel wakes the backend on mount, and no test is about that request.
 */
function stubBackend(onChat: ChatHandler = () => reply("Of course.")) {
  fetchSpy = vi.fn(async (url: unknown, init: RequestInit = {}) => {
    if (String(url).endsWith("/health")) return jsonResponse(200, { status: "ok" });
    return onChat(init);
  });
  vi.stubGlobal("fetch", fetchSpy);
}

/** Only the chat turns — the mount-time `/health` ping is noise for most assertions. */
const chatCalls = () =>
  fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/chat"));

const bodyOf = (index: number) =>
  JSON.parse((chatCalls()[index][1] as RequestInit).body as string);

const input = () => screen.getByRole("textbox", { name: "Ask Amaya" });
const sendButton = () => screen.getByRole("button", { name: "Send message" });
const turns = () =>
  within(
    screen.getByRole("list", { name: "Conversation with Amaya" }),
  ).getAllByRole("listitem");

/** Types into the input and submits the form — the path Enter and the button share. */
function sendText(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.submit(input().closest("form")!);
}

function deferred() {
  let resolve!: (value: Response) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BASE);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("chat panel header", () => {
  it("introduces the agent as Amaya, with an honest status line", () => {
    stubBackend();
    render(<ChatPanel />);

    // Amaya is the advisor; Property Advisor is the brokerage. The header names
    // her, not the brand — the brand belongs to the navbar and footer.
    expect(screen.getByText("Amaya — AI Advisor")).toBeInTheDocument();
    expect(screen.getByText(AGENT_STATUS_LINE)).toBeInTheDocument();
  });

  it("no longer promises instant replies", () => {
    stubBackend();
    const { container } = render(<ChatPanel />);

    // A ~22s cold start makes this false, and it set an expectation the service
    // cannot meet. Guarding the exact old string keeps it from creeping back.
    expect(container.textContent).not.toMatch(/replies instantly/i);
  });

  it("never uses the mockup's placeholder brand", () => {
    stubBackend();
    const { container } = render(<ChatPanel />);

    // `context/ui-interface.png` is reference art; its "Terra" wording is not
    // this product's name and must not reach the DOM.
    expect(container.textContent).not.toMatch(/terra/i);
  });
});

describe("on mount", () => {
  it("opens with Amaya's greeting and nothing else", () => {
    stubBackend();
    render(<ChatPanel />);

    const list = turns();
    expect(list).toHaveLength(1);
    expect(list[0]).toHaveTextContent(GREETING);
    // Spoken by her, so it must be announced as hers.
    expect(list[0]).toHaveTextContent(/^Amaya:/);
  });

  it("wakes the backend without sending a message", () => {
    stubBackend();
    render(<ChatPanel />);

    expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE}/health`);
    // The greeting is a local constant. Rendering it must cost no conversation, or every
    // bounced visit would leave a row in the database.
    expect(chatCalls()).toHaveLength(0);
  });
});

describe("sending a message", () => {
  it("appends the message optimistically and clears the input", () => {
    stubBackend(() => deferred().promise);
    render(<ChatPanel />);

    sendText("Anything in Colombo 7?");

    expect(turns()[1]).toHaveTextContent("Anything in Colombo 7?");
    expect(turns()[1]).toHaveTextContent(/^You:/);
    expect(input()).toHaveValue("");
  });

  it("posts the message with a session id", () => {
    stubBackend();
    render(<ChatPanel />);

    sendText("Hello");

    expect(bodyOf(0).message).toBe("Hello");
    expect(bodyOf(0).session_id).toEqual(expect.any(String));
    expect(bodyOf(0).session_id).not.toHaveLength(0);
  });

  it("appends the reply when it arrives", async () => {
    stubBackend(() => reply("There's a villa on Ward Place."));
    render(<ChatPanel />);

    sendText("Colombo 7?");
    await act(async () => {});

    expect(turns()[2]).toHaveTextContent("There's a villa on Ward Place.");
    expect(turns()[2]).toHaveTextContent(/^Amaya:/);
  });

  it("keeps one session id across turns, so the backend keeps one conversation", async () => {
    stubBackend();
    render(<ChatPanel />);

    sendText("First");
    await act(async () => {});
    sendText("Second");
    await act(async () => {});

    expect(chatCalls()).toHaveLength(2);
    expect(bodyOf(1).session_id).toBe(bodyOf(0).session_id);
  });

  it("trims the message before sending it", () => {
    stubBackend();
    render(<ChatPanel />);

    sendText("  Hello  ");

    expect(bodyOf(0).message).toBe("Hello");
  });

  it("fires no request for whitespace-only input, and adds no bubble", () => {
    stubBackend();
    render(<ChatPanel />);

    sendText("   ");

    // The backend would answer 422; there is no reason to learn that over the network.
    expect(chatCalls()).toHaveLength(0);
    expect(turns()).toHaveLength(1);
  });

  it("submits through a form, which is what makes Enter send", () => {
    stubBackend();
    render(<ChatPanel />);

    // jsdom implements no implicit submission, so this asserts the structure rather than
    // the keystroke: an input inside a form, and a real submit button. Enter itself is
    // browser-verified.
    const form = input().closest("form");
    expect(form).not.toBeNull();
    expect(sendButton()).toHaveAttribute("type", "submit");
    expect(form).toContainElement(sendButton());
  });
});

describe("input constraints", () => {
  it("caps the input at the backend's own limit", () => {
    stubBackend();
    render(<ChatPanel />);

    // 2000 mirrors MAX_MESSAGE_LENGTH in backend/app/schemas/chat.py, which is what makes
    // the server's 422 unreachable through the UI.
    expect(input()).toHaveAttribute("maxlength", "2000");
  });

  it("accepts a message of exactly the limit", () => {
    stubBackend();
    render(<ChatPanel />);

    const atLimit = "x".repeat(2000);
    sendText(atLimit);

    expect(bodyOf(0).message).toHaveLength(2000);
  });

  it("disables send until something has been typed", () => {
    stubBackend();
    render(<ChatPanel />);

    expect(sendButton()).toBeDisabled();

    fireEvent.change(input(), { target: { value: "Hi" } });
    expect(sendButton()).toBeEnabled();

    // Whitespace is not something to send.
    fireEvent.change(input(), { target: { value: "   " } });
    expect(sendButton()).toBeDisabled();
  });
});

describe("suggestion chips", () => {
  it("offers the three chips and sends the one clicked", () => {
    stubBackend();
    render(<ChatPanel />);

    for (const chip of SUGGESTION_CHIPS) {
      expect(screen.getByRole("button", { name: chip })).toBeEnabled();
    }

    fireEvent.click(screen.getByRole("button", { name: SUGGESTION_CHIPS[0] }));

    expect(bodyOf(0).message).toBe(SUGGESTION_CHIPS[0]);
    expect(turns()[1]).toHaveTextContent(SUGGESTION_CHIPS[0]);
  });
});

describe("while a request is in flight", () => {
  it("disables the input, send, and every chip", () => {
    stubBackend(() => deferred().promise);
    render(<ChatPanel />);

    sendText("Hello");

    expect(input()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
    for (const chip of SUGGESTION_CHIPS) {
      expect(screen.getByRole("button", { name: chip })).toBeDisabled();
    }
  });

  it("shows a pending turn with text, not just animated dots", () => {
    stubBackend(() => deferred().promise);
    render(<ChatPanel />);

    sendText("Hello");

    // Dots are `aria-hidden`; without this label a screen-reader user gets silence.
    expect(screen.getByText(PENDING_LABEL)).toBeInTheDocument();
  });

  it("says it is still waking up rather than sitting silent", () => {
    vi.useFakeTimers();
    try {
      stubBackend(() => deferred().promise);
      render(<ChatPanel />);

      sendText("Hello");
      expect(screen.getByText(PENDING_LABEL)).toBeInTheDocument();

      // A cold start can run ~30s. Silence that long reads as a dead panel.
      act(() => {
        vi.advanceTimersByTime(SLOW_PENDING_AFTER_MS);
      });

      expect(screen.getByText(SLOW_PENDING_LABEL)).toBeInTheDocument();
      expect(screen.queryByText(PENDING_LABEL)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the pending turn once the reply lands", async () => {
    const pending = deferred();
    stubBackend(() => pending.promise);
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {
      pending.resolve(reply("Here you go."));
    });

    expect(screen.queryByText(PENDING_LABEL)).not.toBeInTheDocument();
    expect(input()).toBeEnabled();
    expect(screen.getByText(/Here you go\./)).toBeInTheDocument();
  });
});

describe("when a turn fails", () => {
  const failWith = (status: number) => () => jsonResponse(status, { detail: "nope" });

  it("keeps the message on screen and announces the failure", async () => {
    stubBackend(failWith(502));
    render(<ChatPanel />);

    sendText("Anything in Galle?");
    await act(async () => {});

    // The bubble stays: the server discarded the whole turn, so nothing was recorded and
    // the visitor should not have to retype.
    expect(turns()[1]).toHaveTextContent("Anything in Galle?");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(ERROR_COPY.upstream);
  });

  it("leaves the panel usable", async () => {
    stubBackend(failWith(502));
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {});

    expect(input()).toBeEnabled();
    for (const chip of SUGGESTION_CHIPS) {
      expect(screen.getByRole("button", { name: chip })).toBeEnabled();
    }
  });

  it("offers a retry for a transient failure", async () => {
    stubBackend(failWith(502));
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {});

    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("says something different for a 503, and offers no retry", async () => {
    stubBackend(failWith(503));
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {});

    // The key is missing server-side. A retry button here would be a lie.
    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_COPY.unavailable);
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(ERROR_COPY.unavailable).not.toBe(ERROR_COPY.upstream);
  });

  it("reports an unreachable backend without guessing why", async () => {
    stubBackend(() => {
      throw new TypeError("Failed to fetch");
    });
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {});

    // A CORS rejection is indistinguishable from being offline, so the copy stays vague.
    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_COPY.network);
  });

  it("reports a timeout as its own thing", async () => {
    stubBackend(() => {
      throw Object.assign(new Error("slow"), { name: "TimeoutError" });
    });
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {});

    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_COPY.timeout);
  });

  it("resends the same text on retry without duplicating the bubble", async () => {
    let attempt = 0;
    stubBackend(() => {
      attempt += 1;
      return attempt === 1
        ? jsonResponse(502, { detail: "nope" })
        : reply("Found a few in Galle.");
    });
    render(<ChatPanel />);

    sendText("Anything in Galle?");
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => {});

    expect(chatCalls()).toHaveLength(2);
    expect(bodyOf(1).message).toBe("Anything in Galle?");
    // Same conversation, so the backend appends rather than forking.
    expect(bodyOf(1).session_id).toBe(bodyOf(0).session_id);

    // One user bubble, one greeting, one reply — the retry must not add a second copy.
    const texts = turns().map((turn) => turn.textContent ?? "");
    expect(texts.filter((text) => text.includes("Anything in Galle?"))).toHaveLength(1);
    expect(turns()).toHaveLength(3);
  });

  it("clears the alert once a retry succeeds", async () => {
    let attempt = 0;
    stubBackend(() => {
      attempt += 1;
      return attempt === 1 ? jsonResponse(502, {}) : reply("All good now.");
    });
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => {});

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/All good now\./)).toBeInTheDocument();
  });

  it("marks the failed bubble for screen readers, not just visually", async () => {
    stubBackend(failWith(502));
    render(<ChatPanel />);

    sendText("Hello");
    await act(async () => {});

    // Opacity is the visual cue and it carries nothing to assistive tech.
    expect(turns()[1]).toHaveTextContent("(not sent)");
  });
});

describe("accessibility", () => {
  it("announces new replies through a polite live region", () => {
    stubBackend();
    render(<ChatPanel />);

    // A reply arrives with no focus change, so nothing else would announce it. Polite,
    // because an answer is worth hearing at the next pause rather than mid-sentence.
    const list = screen.getByRole("list", { name: "Conversation with Amaya" });
    expect(list).toHaveAttribute("aria-live", "polite");
  });

  it("keeps both of the panel's labels", () => {
    stubBackend();
    render(<ChatPanel />);

    expect(
      screen.getByRole("region", { name: "AI agent chat" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Conversation with Amaya" }),
    ).toBeInTheDocument();
  });

  it("names the speaker in text on every turn", async () => {
    stubBackend(() => reply("Two, actually."));
    render(<ChatPanel />);

    sendText("How many?");
    await act(async () => {});

    // Colour and alignment are the only visual cue to who is speaking, and neither is
    // perceivable to a screen reader — hence the visually hidden prefix.
    expect(turns()[0]).toHaveTextContent(/^Amaya:/);
    expect(turns()[1]).toHaveTextContent(/^You:/);
    expect(turns()[2]).toHaveTextContent(/^Amaya:/);
  });

  it("tints each speaker's bubble from the theme, not a literal colour", async () => {
    stubBackend(() => reply("Right away."));
    render(<ChatPanel />);

    sendText("Hi");
    await act(async () => {});

    // Deletion guards for the two `@theme` tokens the bubbles depend on.
    expect(turns()[1].firstElementChild).toHaveClass("bg-brand", "text-on-brand");
    expect(turns()[2].firstElementChild).toHaveClass("bg-agent-bubble", "text-ink");
  });
});

describe("chat panel as a jump target", () => {
  it("stays focusable so the hero and navbar CTAs land on it", () => {
    stubBackend();
    render(<ChatPanel />);
    const panel = screen.getByRole("region", { name: "AI agent chat" });

    expect(panel).toHaveAttribute("id", "chat");
    // Without tabIndex a #chat jump moves the viewport but not keyboard focus.
    expect(panel).toHaveAttribute("tabindex", "-1");
    // Scroll margin matches the sticky inset so the panel lands where it settles.
    expect(panel).toHaveClass("scroll-mt-panel-inset");
  });
});
