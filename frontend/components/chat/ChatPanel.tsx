"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChatError,
  MAX_MESSAGE_LENGTH,
  sendChatMessage,
  wakeBackend,
} from "@/lib/api";
import {
  AGENT_STATUS_LINE,
  ERROR_COPY,
  GREETING,
  PENDING_LABEL,
  SLOW_PENDING_AFTER_MS,
  SLOW_PENDING_LABEL,
  SPEAKER_LABELS,
  SUGGESTION_CHIPS,
  type ChatMessage,
} from "@/lib/chat";

/**
 * Decorative avatar mark. `aria-hidden` because the agent's name sits right
 * beside it — announcing the glyph too would only duplicate that.
 */
const SparkleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="size-4"
  >
    <path d="M13 2.5 14.6 7 19 8.6 14.6 10.2 13 14.7 11.4 10.2 7 8.6 11.4 7Z" />
    <path d="M6.5 13.5 7.4 16l2.6.9-2.6.9L6.5 20.4 5.6 17.8 3 16.9l2.6-.9Z" />
  </svg>
);

/** Decorative: the button's `aria-label` carries the meaning. */
const SendIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
  >
    <path d="M21.5 2.5 11 13M21.5 2.5l-6.8 19-3.7-8.5L2.5 9.3Z" />
  </svg>
);

/**
 * Three dots while we wait. `aria-hidden` because the pending bubble carries real text for
 * assistive tech — animation alone announces nothing. `motion-safe:` so a visitor who asked
 * for less motion gets three static dots instead.
 */
const TypingDots = () => (
  <span aria-hidden="true" className="flex items-center gap-1 py-1">
    {[0, 150, 300].map((delay) => (
      <span
        key={delay}
        style={{ animationDelay: `${delay}ms` }}
        className="size-1.5 rounded-full bg-muted motion-safe:animate-bounce"
      />
    ))}
  </span>
);

/** What we know about a turn that failed, and everything needed to send it again. */
type Failure = {
  /** The user bubble left on screen, so it can be marked rather than removed. */
  messageId: string;
  /** Resent verbatim on retry — the server discarded the turn, so nothing duplicates. */
  text: string;
  error: ChatError;
};

/**
 * The agent chat, wired to `POST /chat`.
 *
 * Client component because everything here is interaction: `app/page.tsx` stays a server
 * component and simply renders it, which is allowed in either direction.
 *
 * Decisions worth knowing before editing:
 *
 * **`session_id` is minted once per page load and never stored.** A reload deliberately
 * starts a fresh conversation, because the panel does not rehydrate history — persisting the
 * id would leave the visitor looking at an empty panel while the model replayed a
 * conversation they cannot see. It is generated lazily on first send rather than in a
 * `useState` initializer, which would also run during SSR.
 *
 * **A failed turn is recoverable, not discarded.** `run_turn` commits once at the very end,
 * so a failure persists nothing at all — not even the user's message. That is what makes
 * resending the same text safe, and why the failed bubble stays on screen instead of being
 * rolled back into the input.
 *
 * **The service is asleep more often than not.** Render's free tier cold-starts in ~22s, so
 * the panel pings `/health` on mount to spend that during reading time, and the pending
 * state grows a "still waking up" line after {@link SLOW_PENDING_AFTER_MS} rather than
 * sitting silent long enough to look broken.
 *
 * Sticky from `lg` up, capped to `--spacing-panel-max` so the panel always fits
 * the viewport. Header, chips, and input are `shrink-0`; the message list is
 * the only part that gives, and the only part that scrolls. Below `lg` the
 * panel sits in normal flow after the grid, where no cap and no inner scrollbar
 * are needed.
 *
 * `id="chat"` is the hero and navbar CTAs' jump target. The scroll margin
 * matches the sticky inset so the panel lands where it will settle, not flush
 * to the viewport edge and then nudged down a beat later.
 */
export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "agent", text: GREETING },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listEndRef = useRef<HTMLLIElement | null>(null);
  const hasRenderedRef = useRef(false);

  /** Lazy so it never runs on the server, where `crypto.randomUUID` would be pointless. */
  const sessionId = () => (sessionIdRef.current ??= crypto.randomUUID());

  /** A counter, not a UUID: these ids only have to be unique within one mounted panel. */
  const nextId = (role: ChatMessage["role"]) => `${role}-${++messageCountRef.current}`;

  useEffect(() => {
    // Fire-and-forget, and deliberately not awaited or reported: it exists only to start the
    // cold boot early. React's dev-mode double effect sends it twice, which is harmless.
    wakeBackend();

    return () => {
      // A reply that lands after the panel is gone must not set state. Aborting here is what
      // makes the in-flight request observable as cancelled rather than as a failure.
      abortRef.current?.abort();
      if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Skipped on the very first render: the greeting is already in place, and scrolling to it
    // on mount would drag the page down to the panel before the visitor has done anything.
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true;
      return;
    }
    // `?.()` because jsdom has no layout engine and does not implement scrollIntoView; this
    // is a browser-only behaviour and the test suite must not trip over it. `nearest` keeps
    // the movement inside the scrolling list rather than jumping the whole window.
    listEndRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages, pending, failure]);

  const runTurn = useCallback(async (text: string, messageId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    setPending(true);
    setSlow(false);
    setFailure(null);
    slowTimerRef.current = setTimeout(() => setSlow(true), SLOW_PENDING_AFTER_MS);

    try {
      const response = await sendChatMessage({
        sessionId: sessionId(),
        message: text,
        signal: controller.signal,
      });
      setMessages((current) => [
        ...current,
        { id: nextId("agent"), role: "agent", text: response.reply },
      ]);
    } catch (error) {
      // Our own abort — the panel unmounted mid-request. There is nobody left to tell.
      if (controller.signal.aborted) return;
      setFailure({
        messageId,
        text,
        error:
          error instanceof ChatError
            ? error
            : new ChatError("unexpected", String(error)),
      });
    } finally {
      if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current);
      if (!controller.signal.aborted) {
        setPending(false);
        setSlow(false);
      }
    }
  }, []);

  const submit = (text: string) => {
    const trimmed = text.trim();
    // Whitespace-only costs no request. The backend would return a 422; there is no reason
    // to find that out over the network.
    if (!trimmed || pending) return;

    const id = nextId("user");
    setMessages((current) => [...current, { id, role: "user", text: trimmed }]);
    setDraft("");
    void runTurn(trimmed, id);
  };

  const retry = () => {
    if (!failure || pending) return;
    // No second bubble: the first one is still on screen, and the server kept nothing.
    void runTurn(failure.text, failure.messageId);
  };

  const canSend = draft.trim().length > 0 && !pending;

  return (
    <section
      id="chat"
      aria-label="AI agent chat"
      /*
        `tabIndex={-1}` is what makes the CTA move keyboard focus here, not just
        the viewport — a plain <section> is not a focus target otherwise.
      */
      tabIndex={-1}
      /*
        No padding on the section itself: the header band runs edge to edge, so
        each part below pads itself instead. `overflow-hidden` is what keeps the
        band's corners inside the rounded border — it clips children only, so
        neither the focus outline nor `lg:sticky` is affected by it.
      */
      className="flex scroll-mt-panel-inset flex-col overflow-hidden rounded-xl border border-neutral-200 bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:sticky lg:top-panel-inset lg:max-h-panel-max"
    >
      {/*
        A plain <div>, not a <header>. Nesting a sectioning element's own
        <header> is valid HTML, but the role only narrows to non-landmark in
        browsers that implement the HTML-AAM scoping rule — everything else
        reports a second `banner` alongside the site header. Same reasoning as
        the mobile menu using a plain <ul> rather than a nested <nav>.
      */}
      <div className="flex shrink-0 items-center gap-3 bg-band-strong px-4 py-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand"
        >
          <SparkleIcon />
        </span>
        {/* `min-w-0` so a narrow panel wraps the name instead of overflowing. */}
        <div className="min-w-0">
          <p className="font-display text-[0.9375rem] leading-tight text-ink">
            Amaya — AI Advisor
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            {/* Status colour is decorative; the word "Online" carries it. */}
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-brand"
            />
            {AGENT_STATUS_LINE}
          </p>
        </div>
      </div>

      {/*
        A list, not a stack of divs, so a screen reader announces each turn
        rather than one run-on paragraph.

        `aria-live="polite"` is what tells a screen-reader user the answer arrived: replies
        appear without any focus change, so nothing else would announce them. Polite rather
        than assertive — an answer is worth hearing at the next pause, not mid-sentence.

        `min-h-72` gives the region a usable floor before it has grown into its
        content. At `lg` that floor drops to `min-h-64` and `flex-1` takes over:
        the panel grows with the conversation until it hits `max-h-panel-max`,
        after which the list is the part that shrinks and scrolls. The floor has
        to stay under the space left by the header, chips, and input at a short
        viewport, or the panel would push its own input off-screen.
      */}
      <ul
        aria-label="Conversation with Amaya"
        aria-live="polite"
        className="flex min-h-72 flex-col gap-3 px-4 py-4 lg:min-h-64 lg:flex-1 lg:overflow-y-auto"
      >
        {messages.map((message) => {
          const isUser = message.role === "user";
          const hasFailed = failure?.messageId === message.id;

          return (
            <li
              key={message.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/*
                The squared corner marks the sending side, mirrored per speaker.
                `wrap-break-word` is for the pathological case — one unbroken
                token such as a URL — which would otherwise widen the bubble
                past its cap and force the whole panel to scroll sideways.
              */}
              <p
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed wrap-break-word ${
                  isUser
                    ? "rounded-br-md bg-brand text-on-brand"
                    : "rounded-bl-md bg-agent-bubble text-ink"
                } ${
                  /* Dimmed so the failed turn reads as unsent without removing it. The
                     adjacent alert carries the actual explanation. */
                  hasFailed ? "opacity-60" : ""
                }`}
              >
                {/*
                  Side and colour are the only visual cue to who is speaking,
                  and neither survives being read aloud.
                */}
                <span className="sr-only">{SPEAKER_LABELS[message.role]}: </span>
                {message.text}
                {hasFailed && <span className="sr-only"> (not sent)</span>}
              </p>
            </li>
          );
        })}

        {pending && (
          <li className="flex justify-start">
            <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-agent-bubble px-3.5 py-2.5 text-sm leading-relaxed text-ink">
              {/*
                Real text either way — dots alone are invisible to a screen reader. Once the
                wait has gone on long enough to look broken, the reassurance becomes visible
                to everyone rather than staying screen-reader-only.
              */}
              {slow ? (
                <span className="text-muted">{SLOW_PENDING_LABEL}</span>
              ) : (
                <>
                  <span className="sr-only">{PENDING_LABEL}</span>
                  <TypingDots />
                </>
              )}
            </p>
          </li>
        )}

        {/* Scroll anchor. An empty <li> so the list keeps only <li> children. */}
        <li ref={listEndRef} aria-hidden="true" />
      </ul>

      {failure && (
        /*
          `role="alert"` announces immediately and without focus moving — a failure is the
          one thing here worth interrupting for. It sits directly under the dimmed bubble it
          refers to, which is always the last message, so the two read as one unit.
        */
        <div
          role="alert"
          className="shrink-0 px-4 pb-3 text-xs leading-relaxed text-muted"
        >
          <p>{ERROR_COPY[failure.error.kind]}</p>
          {failure.error.retryable && (
            <button
              type="button"
              onClick={retry}
              disabled={pending}
              className="mt-1.5 rounded-full border border-neutral-200 px-3 py-1.5 font-medium text-ink hover:bg-band-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* `items-start` shrink-wraps each pill to its label, as in the mockup;
          `max-w-full` keeps the longest one inside the panel at 375px. */}
      <div className="flex shrink-0 flex-col items-start gap-2 px-4 pb-4">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => submit(chip)}
            disabled={pending}
            className="max-w-full rounded-full border border-neutral-200 px-3.5 py-2 text-left text-xs text-muted hover:bg-band-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-4 py-3">
        {/*
          A real <form>, which is what makes Enter send with no keydown handler of our own,
          and what lets the browser own the semantics of a submit button.
        */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
          className="flex items-center gap-2 rounded-full border border-neutral-200 py-1.5 pr-1.5 pl-4"
        >
          {/* No visible label in the mockup, and a placeholder is not a name. */}
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={pending}
            /* Mirrors the backend's own limit, so its 422 is unreachable from the UI. */
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label="Ask Amaya"
            placeholder="Ask about a neighbourhood, budget, or style…"
            /*
              The panel column is ~300px at `lg`, too narrow for the full
              placeholder. `text-ellipsis` is what makes it trail off cleanly
              instead of being sliced mid-word against the send button.
            */
            className="min-w-0 flex-1 bg-transparent text-sm text-ellipsis text-ink placeholder:text-muted focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </section>
  );
}
