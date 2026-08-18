/**
 * Types and copy for the chat panel.
 *
 * The seeded conversation that used to live here is gone: the panel talks to `POST /chat`
 * now, so the only message it invents is Amaya's greeting. Everything else arrives from the
 * backend, which is also the single source of truth for the transcript — `messages` rows in
 * Postgres, replayed to the model every turn.
 *
 * Wording lives here rather than inline in the panel so that changing what Amaya says never
 * means reading JSX, and so the error copy can be asserted against `ChatErrorKind` directly.
 */

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
  "Hi, I'm Amaya, an advisor at Property Advisor. Whether you're after land, a house, or an apartment — buying, renting, or selling — tell me what you have in mind and I'll take it from there.";

/** Clicking one sends it as a message, so each has to read as something a visitor would type. */
export const SUGGESTION_CHIPS: string[] = [
  "3-bedroom homes in Colombo under LKR 50M",
  "Beachside properties in Galle",
  "What's trending in Rajagiriya?",
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
export const AGENT_STATUS_LINE = "Online · answers take a moment";

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
  "Still waking up — this can take a little longer after a quiet spell.";

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
  config: "Chat isn't configured on this site yet — that's on us, not you.",
  timeout: "That took longer than I could wait for. Worth another try.",
  network: "I couldn't get through to our server just then. Try again in a moment.",
  upstream: "Something went wrong on my side answering that. Try again?",
  unavailable:
    "I'm offline at the moment — this one's on us, and trying again won't help. Do come back a little later.",
  unexpected: "Something unexpected came back from our server. Try again?",
};
