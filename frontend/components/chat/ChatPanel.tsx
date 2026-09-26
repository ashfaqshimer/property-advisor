"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import {
  ChatError,
  captureFallbackLead,
  getFeaturedProperties,
  MAX_MESSAGE_LENGTH,
  sendChatMessage,
  wakeBackend,
} from "@/lib/api";
import {
  AGENT_STATUS_LINE,
  FALLBACK_PROPERTY_SUGGESTIONS,
  GREETING,
  PENDING_LABEL,
  SLOW_PENDING_AFTER_MS,
  SLOW_PENDING_LABEL,
  SPEAKER_LABELS,
  SELLING_SUGGESTION,
  type ChatMessage,
} from "@/lib/chat";
import { mapProperty, type Property } from "@/lib/properties";

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

export default function ChatPanel() {
  const [featuredProperties, setFeaturedProperties] = useState<Property[] | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "agent", text: GREETING },
  ]);
  const [draft, setDraft] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [fallbackName, setFallbackName] = useState("");
  const [fallbackPhone, setFallbackPhone] = useState("");
  const [fallbackPending, setFallbackPending] = useState(false);
  const [fallbackSubmitted, setFallbackSubmitted] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

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
    wakeBackend();
    return () => {
      abortRef.current?.abort();
      if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current);
    };
  }, []);

  useEffect(() => {
    getFeaturedProperties()
      .then((records) => setFeaturedProperties(records.slice(0, 3).map(mapProperty)))
      .catch(() => setFeaturedProperties([]));
  }, []);

  useEffect(() => {
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true;
      return;
    }
    listEndRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages, pending, failure]);

  const runTurn = useCallback(async (text: string, messageId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    setFailure(null);
    setFallbackSubmitted(false);
    setFallbackError(false);
    setIsReading(true);
    
    const startGenerating = () => {
      if (controller.signal.aborted) return;
      setIsReading(false);
      setIsGenerating(true);
      setPending(true);
      setSlow(false);
      slowTimerRef.current = setTimeout(() => setSlow(true), SLOW_PENDING_AFTER_MS);
    };

    let pendingTimer: ReturnType<typeof setTimeout> | undefined;
    if (process.env.NODE_ENV === "test") {
      startGenerating();
    } else {
      const readingTime = Math.min(400 + text.length * 8, 1200);
      pendingTimer = setTimeout(startGenerating, readingTime);
    }

    const agentMessageId = nextId("agent");

    try {
      const { reply } = await sendChatMessage({
        sessionId: sessionId(),
        message: text,
        signal: controller.signal,
        onChunk: (chunk) => {
          clearTimeout(pendingTimer);
          setIsReading(false);
          setIsGenerating(true);
          setPending(false);
          setSlow(false);
          if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current);
          
          setMessages((current) => {
            const exists = current.some((m) => m.id === agentMessageId);
            if (exists) {
              return current.map((m) =>
                m.id === agentMessageId ? { ...m, text: m.text + chunk } : m
              );
            }
            return [...current, { id: agentMessageId, role: "agent", text: chunk }];
          });
        }
      });
      
      setMessages((current) => {
        const exists = current.some((m) => m.id === agentMessageId);
        if (exists) {
          return current.map((m) =>
            m.id === agentMessageId ? { ...m, text: reply } : m
          );
        }
        return [...current, { id: agentMessageId, role: "agent", text: reply }];
      });
      
    } catch (error) {
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
      clearTimeout(pendingTimer);
      if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current);
      if (!controller.signal.aborted) {
        setIsReading(false);
        setIsGenerating(false);
        setPending(false);
        setSlow(false);
      }
    }
  }, []);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const id = nextId("user");
    setMessages((current) => [...current, { id, role: "user", text: trimmed }]);
    setDraft("");
    void runTurn(trimmed, id);
  };

  const submitFallbackLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!failure || !fallbackPhone.trim() || fallbackPending) return;

    setFallbackPending(true);
    setFallbackError(false);
    try {
      await captureFallbackLead({
        sessionId: sessionId(),
        name: fallbackName,
        phone: fallbackPhone,
      });
      setFallbackSubmitted(true);
    } catch {
      setFallbackError(true);
    } finally {
      setFallbackPending(false);
    }
  };

  const canSend = draft.trim().length > 0 && !pending;
  const hasStartedChat = messages.some((message) => message.role === "user");
  const propertySuggestions = (featuredProperties ?? []).map(
    (property) => `Tell me more about ${property.title} in ${property.location}`,
  );
  const suggestionChips = [
    SELLING_SUGGESTION,
    ...propertySuggestions,
    ...FALLBACK_PROPERTY_SUGGESTIONS.slice(0, 3 - propertySuggestions.length),
  ];

  let statusText = AGENT_STATUS_LINE;
  let statusColor = "bg-green-500";
  if (isReading) {
    statusText = "Reading...";
  } else if (isGenerating) {
    statusText = pending ? "Typing..." : "Replying...";
  }

  return (
    <section
      id="chat"
      aria-label="AI agent chat"
      tabIndex={-1}
      className="flex scroll-mt-panel-inset flex-col overflow-hidden rounded-xl border border-neutral-200 bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:sticky lg:top-panel-inset lg:max-h-panel-max"
    >
      <div className="flex shrink-0 items-center gap-3 bg-band-strong px-5 py-4">
        <Image
          src="/images/amaya_avatar_compressed.png"
          alt=""
          width={48}
          height={48}
          aria-hidden="true"
          className="size-12 shrink-0 rounded-full object-cover"
        >
        </Image>
        <div className="min-w-0">
          <p className="font-display text-[0.9375rem] leading-tight text-ink">
            Amaya Perera
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${statusColor}`}
            />
            <AnimatePresence mode="wait">
              <motion.span
                key={statusText}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.15 }}
                className="inline-block"
              >
                {statusText}
              </motion.span>
            </AnimatePresence>
          </p>
        </div>
      </div>

      <ul
        aria-label="Conversation with Amaya"
        aria-live="polite"
        className="flex min-h-96 flex-col gap-3 px-4 py-4 lg:flex-1 lg:overflow-y-auto overflow-x-hidden"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const isUser = message.role === "user";
            const hasFailed = failure?.messageId === message.id;

            return (
              <motion.li
                key={message.id}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
                    isUser
                      ? "rounded-br-md bg-brand text-on-brand"
                      : "rounded-bl-md bg-agent-bubble text-ink"
                  }`}
                >
                  <span className="sr-only">{SPEAKER_LABELS[message.role]}: </span>
                  {message.text}
                  {hasFailed && <span className="sr-only"> (not sent)</span>}
                </p>
              </motion.li>
            );
          })}

          {pending && (
            <motion.li
              key="pending-dots"
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex justify-start origin-bottom-left"
            >
              <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-agent-bubble px-3.5 py-2.5 text-sm leading-relaxed text-ink">
                {slow ? (
                  <span className="text-muted">{SLOW_PENDING_LABEL}</span>
                ) : (
                  <>
                    <span className="sr-only">{PENDING_LABEL}</span>
                    <TypingDots />
                  </>
                )}
              </p>
            </motion.li>
          )}
        </AnimatePresence>

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
          <p>Our agents are unavailable right now. Leave your number and we&apos;ll call you back.</p>
          {!fallbackSubmitted ? (
            <>
              <form onSubmit={submitFallbackLead} className="mt-2 flex flex-col gap-2">
                <input
                  type="text"
                  value={fallbackName}
                  onChange={(event) => setFallbackName(event.target.value)}
                  maxLength={120}
                  aria-label="Your name"
                  placeholder="Your name (optional)"
                  className="rounded-md border border-neutral-200 bg-surface px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
                />
                <input
                  type="tel"
                  value={fallbackPhone}
                  onChange={(event) => setFallbackPhone(event.target.value)}
                  maxLength={40}
                  required
                  aria-label="Your phone number"
                  placeholder="Your phone number"
                  className="rounded-md border border-neutral-200 bg-surface px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
                />
                <button
                  type="submit"
                  disabled={!fallbackPhone.trim() || fallbackPending}
                  className="self-start rounded-full bg-green-600 px-3 py-1.5 font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
                >
                  {fallbackPending ? "Sending…" : "Request a call"}
                </button>
                {fallbackError && <p className="text-red-700">We couldn&apos;t save that. Please try again.</p>}
              </form>
            </>
          ) : (
            <p className="mt-2 text-brand">Thanks. An agent will call you back soon.</p>
          )}
        </div>
      )}

      {!hasStartedChat && (
        /* `items-start` shrink-wraps each pill to its label, as in the mockup;
            `max-w-full` keeps the longest one inside the panel at 375px. */
        <div className="flex shrink-0 flex-col items-start gap-2 px-4 pb-4">
          {featuredProperties === null ? (
            <>
              <div className="h-[34px] w-64 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-[34px] w-80 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-[34px] w-72 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-[34px] w-56 animate-pulse rounded-full bg-neutral-200" />
            </>
          ) : (
            suggestionChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => submit(chip)}
                disabled={pending}
                className="max-w-full rounded-full border border-neutral-200 px-3.5 py-2 text-left text-xs text-muted hover:bg-band-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
              >
                {chip}
              </button>
            ))
          )}
        </div>
      )}

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
            className="grid size-8 shrink-0 place-items-center rounded-full bg-green-600 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </section>
  );
}
