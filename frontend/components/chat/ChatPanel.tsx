import {
  SEED_CONVERSATION,
  SPEAKER_LABELS,
  SUGGESTION_CHIPS,
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
 * The agent chat, as static markup — a server component with no state and no
 * handlers. Every control below is rendered `disabled` on purpose: the panel
 * has to look live, but `POST /chat` does not exist yet, so a control that
 * responded to a click would be lying. They get enabled by the backend chat
 * feature, which is when this file gains `'use client'`.
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
            Online · replies instantly
          </p>
        </div>
      </div>

      {/*
        A list, not a stack of divs, so a screen reader announces four turns
        rather than one run-on paragraph.

        `min-h-72` gives the region a usable floor before it has grown into its
        content. At `lg` that floor drops to `min-h-64` and `flex-1` takes over:
        the panel grows with the conversation until it hits `max-h-panel-max`,
        after which the list is the part that shrinks and scrolls. The floor has
        to stay under the space left by the header, chips, and input at a short
        viewport, or the panel would push its own input off-screen.
      */}
      <ul
        aria-label="Conversation with Amaya"
        className="flex min-h-72 flex-col gap-3 px-4 py-4 lg:min-h-64 lg:flex-1 lg:overflow-y-auto"
      >
        {SEED_CONVERSATION.map((message) => {
          const isUser = message.role === "user";

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
                }`}
              >
                {/*
                  Side and colour are the only visual cue to who is speaking,
                  and neither survives being read aloud.
                */}
                <span className="sr-only">{SPEAKER_LABELS[message.role]}: </span>
                {message.text}
              </p>
            </li>
          );
        })}
      </ul>

      {/* `items-start` shrink-wraps each pill to its label, as in the mockup;
          `max-w-full` keeps the longest one inside the panel at 375px. */}
      <div className="flex shrink-0 flex-col items-start gap-2 px-4 pb-4">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled
            className="max-w-full rounded-full border border-neutral-200 px-3.5 py-2 text-left text-xs text-muted"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 py-1.5 pr-1.5 pl-4">
          {/* No visible label in the mockup, and a placeholder is not a name. */}
          <input
            type="text"
            disabled
            aria-label="Ask Amaya"
            placeholder="Ask about a neighbourhood, budget, or style…"
            /*
              The panel column is ~300px at `lg`, too narrow for the full
              placeholder. `text-ellipsis` is what makes it trail off cleanly
              instead of being sliced mid-word against the send button.
            */
            className="min-w-0 flex-1 bg-transparent text-sm text-ellipsis text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            disabled
            aria-label="Send message"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
