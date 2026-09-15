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

/** The first chip is always available, even while featured listings are loading. */
export const SELLING_SUGGESTION = "I want to sell my apartment";

/** Used until featured listings arrive, or when the featured-listings request fails. */
export const FALLBACK_PROPERTY_SUGGESTIONS: string[] = [
  "Tell me about the 3-bedroom apartment in Colombo",
  "Show me properties in Galle",
  "What's available in Rajagiriya?",
];

/** Stable fallback retained for tests and other consumers of the chat constants. */
export const SUGGESTION_CHIPS: string[] = [
  SELLING_SUGGESTION,
  ...FALLBACK_PROPERTY_SUGGESTIONS,
];

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
 * Swapped in once a request has been slow enough to look broken. A cold start can run ~22s and
 * a tool-calling turn was measured at 30s on its own, so silence here reads as a dead panel
 * rather than a waking one.
 *
 * Deliberately commits to no number. An earlier draft said "up to half a minute", which the
 * measurements above then contradicted — and a pending message that under-promises is worse
 * than one that stays vague.
 */
export const SLOW_PENDING_LABEL =
  "Waiting for the next available agent…";

/** Spec calls for roughly 8–10s: long enough that a warm turn (4–11s) usually never shows it. */
export const SLOW_PENDING_AFTER_MS = 9_000;

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