import type { ChatErrorKind } from "@/lib/api";

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
};

/**
 * Amaya's opening bubble, rendered as soon as the panel mounts — before any request is
 * made, which is the whole reason this string lives on the client at all.
 *
 * DUPLICATED, DELIBERATELY: the same text is `GREETING` in
 * `backend/app/agent/prompts.py`, where `loop.run_turn` persists it as the conversation's
 * `seq 0` so the model replays exactly what the visitor has on screen. Editing one alone is
 * the failure mode, so `backend/tests/test_agent_prompts.py` asserts the two match
 * verbatim and reads *this* file to do it — change both, or that test fails.
 */
export const GREETING =
  "Hi, I'm Amaya with Property Advisor. Whether you're after land, a house, or an apartment, tell me what you have in mind and I'll take it from there.";

/** Dedicated suggestion chips when displaying the Bespoke Services & Market Guide layout */
export const SERVICES_SUGGESTION_CHIPS: string[] = [
  "Find me an off-market property in Colombo",
  "I need a title deed & Land Registry check",
  "I want to discuss a turnkey renovation",
  "I want to list or sell my property",
];

/** The first chip is always available, even while featured listings are loading. */
export const SELLING_SUGGESTION = "I want to sell my apartment";

/** Used until featured listings arrive, or when the featured-listings request fails. */
export const FALLBACK_PROPERTY_SUGGESTIONS: string[] = [
  "Find me an apartment in Colombo 3 or 7",
  "What's available in Rajagiriya?",
  "I need legal advice or renovation help",
];

/** Stable fallback retained for tests and other consumers of the chat constants. */
export const SUGGESTION_CHIPS: string[] = SERVICES_SUGGESTION_CHIPS;

/** How each speaker is announced to a screen reader, since colour and side
 *  alignment carry that distinction visually and neither is perceivable. */
export const SPEAKER_LABELS: Record<ChatMessage["role"], string> = {
  user: "You",
  agent: "Amaya",
};

/**
 * The panel's own header line. It used to read "replies instantly", which stopped being
 * true the moment this talked to a real service: the free tier cold-starts in ~22s. Promising
 * speed we can't deliver is worse than not mentioning it.
 */
export const AGENT_STATUS_LINE = "Online · replies might take a few seconds";

/** Announced while a request is in flight; real text, because animated dots say nothing. */
export const PENDING_LABEL = "Amaya is typing…";

/**
 * Shown in the typing bubble once the backend emits a status event (tool call in progress).
 * Human-sounding so it feels like Amaya thinking, not a loading spinner.
 */
export const STATUS_HINT_DEFAULT = "Just a sec\u2026";

/**
 * Fallback slow label — only shown when no status event has arrived within the threshold
 * (e.g. cold start or pre-tool latency). Raised to 20s: a single tool-calling turn was
 * measured at 16–30s, so 9s was triggering on nearly every search. Kept vague — no ETA.
 */
export const SLOW_PENDING_LABEL = "This one's taking a moment\u2026";

/** Raised from 9s: warm tool-call turns hit 16–30s, so 9s was too eager. */
export const SLOW_PENDING_AFTER_MS = 20_000;

/**
 * What the visitor is told when a turn fails, keyed by the classification `lib/api.ts` made.
 *
 * Two rules shaped this wording. A `network` failure must not claim to know the cause — the
 * browser refuses to say whether it was the connection, DNS, or CORS. And `unavailable` (a
 * 503, meaning the server has no API key) has to read differently from everything else,
 * because it is the one case where pressing retry cannot possibly help.
 */
export const ERROR_COPY: Record<ChatErrorKind, string> = {
  config: "Looks like chat isn't quite set up on our end yet. Sorry about that!",
  timeout: "Sorry, that took too long to load. Want to try asking again?",
  network: "Looks like we lost connection for a second. Could you try sending that again?",
  upstream: "Sorry, I ran into an issue on my end. Can we try that again?",
  unavailable:
    "I'm actually offline right now. Check back a bit later!",
  unexpected: "Sorry, I ran into a weird glitch just now. Mind trying again?",
};