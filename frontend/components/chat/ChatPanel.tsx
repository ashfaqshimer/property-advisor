"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import {
  ChatError,
  captureFallbackLead,
  getFeaturedProperties,
  getSiteConfiguration,
  MAX_MESSAGE_LENGTH,
  sendChatMessage,
  wakeBackend,
  type ChatStatusEvent,
} from "@/lib/api";
import {
  AGENT_STATUS_LINE,
  FALLBACK_PROPERTY_SUGGESTIONS,
  GREETING,
  PENDING_LABEL,
  SERVICES_SUGGESTION_CHIPS,
  SLOW_PENDING_AFTER_MS,
  SLOW_PENDING_LABEL,
  STATUS_HINT_DEFAULT,
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

const SESSION_STORAGE_KEY = "property_advisor_chat_session";

export default function ChatPanel({
  className = "",
  onClose,
  isOpen,
}: {
  className?: string;
  onClose?: () => void;
  isOpen?: boolean;
} = {}) {
  const [featuredProperties, setFeaturedProperties] = useState<Property[] | null>(null);
  const [isServicesLayout, setIsServicesLayout] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "agent", text: GREETING },
  ]);
  const [draft, setDraft] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  /** Text hint received from a backend status event; null = show animated dots. */
  const [statusHint, setStatusHint] = useState<string | null>(null);
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 24), 140);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  /** Restore chat session from sessionStorage on client load */
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "test") return;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        }
        if (typeof data.sessionId === "string" && data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
      }
    } catch {}
  }, []);

  /** Save chat session to sessionStorage across user turns */
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "test") return;
    try {
      if (messages.length > 1 || messages[0]?.id !== "greeting") {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            sessionId: sessionIdRef.current,
            messages,
          })
        );
      }
    } catch {}
  }, [messages]);

  /** When modal opens, scroll to latest message and focus input */
  useEffect(() => {
    if (isOpen) {
      listEndRef.current?.scrollIntoView?.({ block: "nearest" });
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleResetChat = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
    setMessages([{ id: "greeting", role: "agent", text: GREETING }]);
    setDraft("");
    setFailure(null);
    setStatusHint(null);
    setIsReading(false);
    setIsGenerating(false);
    setPending(false);
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {}
    }
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, []);

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlLayout = params.get("layout") || params.get("view");
      if (urlLayout === "services") {
        setIsServicesLayout(true);
      }
    }

    getSiteConfiguration()
      .then((config) => {
        if (config?.extra_settings?.homepage_layout === "services") {
          setIsServicesLayout(true);
        }
      })
      .catch(() => {});
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
    setStatusHint(null);
    
    const startGenerating = () => {
      if (controller.signal.aborted) return;
      setIsReading(false);
      setIsGenerating(true);
      setPending(true);
      setSlow(false);
      setStatusHint(null);
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
        onStatus: (event: ChatStatusEvent) => {
          if (controller.signal.aborted) return;
          // A status event means a tool call is in flight. Show the hint text and
          // cancel the slow timer — the backend is clearly alive and working.
          if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current);
          setSlow(false);
          setStatusHint(event.text || STATUS_HINT_DEFAULT);
        },
        onChunk: (chunk) => {
          clearTimeout(pendingTimer);
          setIsReading(false);
          setIsGenerating(true);
          setPending(false);
          setSlow(false);
          setStatusHint(null);
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
        setStatusHint(null);
      }
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [draft, adjustTextareaHeight]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  };

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const id = nextId("user");
    setMessages((current) => [...current, { id, role: "user", text: trimmed }]);
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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

  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt?: string }>;
      const prompt = customEvent.detail?.prompt;
      if (prompt) {
        submit(prompt);
      }
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    };

    window.addEventListener("open-amaya-chat", handleOpenChat);
    return () => window.removeEventListener("open-amaya-chat", handleOpenChat);
  }, [pending]);

  const canSend = draft.trim().length > 0 && !pending;
  const hasStartedChat = messages.some((message) => message.role === "user");
  const isServicesMode =
    isServicesLayout ||
    (featuredProperties !== null && featuredProperties.length === 0);

  const propertySuggestions = (featuredProperties ?? []).map(
    (property) => `Tell me more about ${property.title} in ${property.location}`,
  );
  const suggestionChips = isServicesMode
    ? SERVICES_SUGGESTION_CHIPS
    : [
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
      className={`relative flex min-h-[580px] scroll-mt-panel-inset flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-surface shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand transition-[height] duration-300 ease-in-out lg:sticky lg:top-panel-inset lg:max-h-panel-max lg:h-[760px] ${className}`}
    >
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {hasStartedChat && (
          <button
            type="button"
            onClick={handleResetChat}
            aria-label="Start new conversation"
            title="Start new conversation"
            className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/80 border border-neutral-200/80 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/80 border border-neutral-200/80 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {!hasStartedChat ? (
          /* Showcase Card before conversation begins */
          <motion.div
            key="showcase-header"
            initial={{ opacity: 0, height: "auto" }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 border-b border-brand/10 bg-gradient-to-b from-agent-bubble via-agent-bubble/40 to-surface p-6 text-center backdrop-blur-xs"
          >
            <div className="relative mx-auto size-36 shrink-0">
              <Image
                src="/images/amaya_avatar.png"
                alt="Amaya Perera"
                width={144}
                height={144}
                priority
                className="size-36 rounded-full object-cover ring-4 ring-brand/15 shadow-md transition-transform duration-300 hover:scale-[1.02]"
              />
              <span
                className="absolute bottom-1.5 right-3 flex size-4 items-center justify-center rounded-full bg-white ring-2 ring-white"
                aria-hidden="true"
              >
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 duration-1000 ${statusColor}`} />
                <span className={`relative inline-flex size-3 rounded-full ${statusColor}`} />
              </span>
            </div>
            <div className="mt-3">
              <p className="font-display text-xl font-bold leading-tight text-ink">
                Amaya Perera
              </p>
              <p className="mt-0.5 text-xs font-semibold text-brand tracking-wide">
                Property Specialist
              </p>
              <p className="mt-2 text-xs text-muted">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={statusText}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.15 }}
                    className="inline-block truncate"
                  >
                    {statusText}
                  </motion.span>
                </AnimatePresence>
              </p>
            </div>
          </motion.div>
        ) : (
          /* Compact Header during active conversation */
          <motion.div
            key="compact-header"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 border-b border-brand/10 bg-gradient-to-b from-agent-bubble/80 to-surface px-5 py-4 backdrop-blur-xs"
          >
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Image
                  src="/images/amaya_avatar.png"
                  alt="Amaya Perera"
                  width={64}
                  height={64}
                  aria-hidden="true"
                  className="size-16 rounded-full object-cover ring-2 ring-brand/20 shadow-sm"
                />
                <span
                  className="absolute bottom-0 right-0 flex size-3.5 items-center justify-center rounded-full bg-white ring-2 ring-white"
                  aria-hidden="true"
                >
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 duration-1000 ${statusColor}`} />
                  <span className={`relative inline-flex size-2.5 rounded-full ${statusColor}`} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold leading-tight text-ink">
                  Amaya Perera
                </p>
                <p className="mt-0.5 text-xs font-medium text-brand">
                  Property Specialist
                </p>
                <p className="mt-1 text-xs text-muted">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={statusText}
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.15 }}
                      className="inline-block truncate"
                    >
                      {statusText}
                    </motion.span>
                  </AnimatePresence>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul
        aria-label="Conversation with Amaya"
        aria-live="polite"
        className="flex flex-1 min-h-0 flex-col gap-3 px-4 py-4 lg:flex-1 lg:overflow-y-auto overflow-x-hidden scrollbar-subtle"
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
                {statusHint ? (
                  // Backend told us it's doing a tool call — show a human hint.
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={statusHint}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="inline-block text-muted"
                    >
                      {statusHint}
                    </motion.span>
                  </AnimatePresence>
                ) : slow ? (
                  // Fallback: no status event yet but the slow timer fired.
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
                  className="self-start rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-on-brand hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
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
                className="group flex max-w-full items-center gap-2 rounded-full border border-neutral-200/90 bg-white/70 px-3.5 py-1.5 text-left text-xs font-medium text-muted transition-all hover:border-brand/40 hover:bg-white hover:text-ink hover:shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <span className="text-brand/60 group-hover:text-brand transition-colors text-[0.6875rem]" aria-hidden="true">
                  ✦
                </span>
                <span className="truncate">{chip}</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="shrink-0 border-t border-neutral-200/80 px-4 py-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
          className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-surface px-3.5 py-2 transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-brand"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label="Ask Amaya"
            placeholder="Ask about a neighbourhood, budget, or style…"
            className="min-w-0 flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none disabled:opacity-60 overflow-y-auto max-h-32 scrollbar-subtle"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all mb-0.5 active:scale-95"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </section>
  );
}
