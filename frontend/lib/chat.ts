/**
 * PLACEHOLDER DATA — replaced by `POST /chat` once the agent backend exists.
 *
 * A seeded conversation so the panel looks like a live chat rather than an
 * empty box. Nothing here is sent or received: the panel is static markup and
 * every control in it is disabled.
 *
 * The exchange is the one in `context/ui-interface.png`, lightly kept, and its
 * listings line up with the fixtures in `lib/properties.ts` — the Havelock Town
 * apartment and the Galle Fort colonial retreat are both in that grid.
 *
 * When the API lands, `ChatMessage` becomes the message type in the request and
 * response payloads and this array goes away, so keep the shape close to what
 * the endpoint will exchange.
 */

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
};

export const SEED_CONVERSATION: ChatMessage[] = [
  {
    id: "colombo-5-budget",
    role: "user",
    text: "What's available in Colombo 5 under LKR 50M?",
  },
  {
    id: "havelock-town-suggestion",
    role: "agent",
    text: "Great area for value. In Havelock Town I have a light-filled 3-bed apartment at LKR 48M — walkable to schools and cafés. I can line up two more in Colombo 5 and 6 in the same range if you like.",
  },
  {
    id: "galle-question",
    role: "user",
    text: "Do you have anything in Galle?",
  },
  {
    id: "galle-fort-suggestion",
    role: "agent",
    text: "Absolutely — we work island-wide. A restored 4-bed colonial retreat inside Galle Fort just came up at LKR 130M, plus a few coastal villas nearby. Want me to prioritise sea views or heritage character?",
  },
];

/** Rendered as disabled buttons; wiring them up is a backend-era feature. */
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
