# Spec: Chat Panel

> **Superseded copy — historical record.** This spec shipped when the panel header and
> speaker prefix said "Home Advisor". The `brand-rename` chore relabelled the assistant
> to **Amaya** ("Amaya — AI Advisor", `Amaya:`, "Conversation with Amaya", "Ask Amaya")
> and renamed the brokerage to **Property Advisor**. Criteria left as written to preserve
> what was agreed at the time; `CLAUDE.md` is authoritative on the brand and persona.

## Goal

Replace the sticky chat panel's four placeholder blocks with the real static UI
from `context/ui-interface.png`: an agent header, a seeded two-turn conversation,
three suggestion chips, and a message input. It should look like a live
conversation with the Home Advisor agent, but nothing responds yet — the backend
doesn't exist.

## Goal state (from the mockup)

```
┌────────────────────────────────────┐
│ (◈) Home Advisor AI Agent          │  header band #e4e4e2, serif name
│     • Online · replies instantly   │  brand-green dot, muted status
├────────────────────────────────────┤
│         ┌───────────────────────┐  │
│         │ What's available in   │  │  user: --color-brand bg,
│         │ Colombo 5 under LKR   │  │  --color-on-brand text, right
│         └───────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Great area for value. In     │  │  agent: #e6eeea bg, ink text,
│  │ Havelock Town I have a…      │  │  left
│  └──────────────────────────────┘  │
│         ┌───────────────────────┐  │
│         │ Do you have anything  │  │
│         │ in Galle?             │  │
│         └───────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Absolutely — we work         │  │
│  │ island-wide. A restored…     │  │
│  └──────────────────────────────┘  │
│                                    │
│ ( 3-bedroom homes in Colombo… )    │  chips: outlined pills,
│ ( Beachside properties in Galle )  │  full-width-ish, stacked
│ ( What's trending in Rajagiriya? ) │
├────────────────────────────────────┤
│ ( Ask about a neighbourhood… ) (➤) │  input + round brand-green send
└────────────────────────────────────┘
```

## Acceptance Criteria

### Scope of interactivity

- [ ] The panel is a **server component** — no `'use client'`, no `useState`, no
      event handlers. Everything is static markup.
- [ ] The input is a real `<input>` with a placeholder and the send control is a
      real `<button type="button">`; both are rendered `disabled` so nothing
      appears broken when clicked, with a comment pointing at the backend feature
      that will enable them.
- [ ] Suggestion chips are `<button type="button">`, also disabled, for the same
      reason.

### Header

- [ ] Renders an avatar (brand-green circle with a decorative `aria-hidden`
      glyph), the name `Home Advisor AI Agent`, and a status line
      `Online · replies instantly` (middot) preceded by a small brand-green dot
      marked `aria-hidden`.
- [ ] The name is **Home Advisor**, never the mockup's "Terra".
- [ ] The header sits on the `--color-band-strong` band (`#e4e4e2`) and does not
      scroll with the messages.

### Messages

- [ ] Seed conversation is four turns, alternating user → agent → user → agent,
      from a typed fixture (`{ id, role: 'user' | 'agent', text }`) defined in one
      place, not hand-written as four hardcoded JSX blocks.
- [ ] User bubbles: `--color-brand` background, `--color-on-brand` text, aligned
      right, rounded with a squared corner on the sending side.
- [ ] Agent bubbles: `#e6eeea` background, `--color-ink` text, aligned left,
      mirrored corner treatment.
- [ ] Bubbles cap at roughly 85% of the panel width so neither side runs edge to
      edge.
- [ ] The message list is a `<ul>` of `<li>` (or `role="log"`) so a screen reader
      reads it as a list of turns rather than one run-on paragraph, and each
      bubble's speaker is announced (visually hidden "You:" / "Home Advisor:"
      rather than colour alone).

### Layout fix (carried over)

- [ ] **The `lg` collapse is fixed.** At `lg` the message region currently
      resolves to ~0 height because `lg:flex-1 lg:min-h-0` has nothing to fill
      under `items-start` on the page grid. The panel must render a usable message
      area at `lg` and `xl`, with a sensible minimum height, and the message list
      — not the whole panel — is the part that scrolls when the conversation
      overflows.
- [ ] Header, chips, and input stay pinned; only the message list scrolls.
- [ ] The panel still respects `--spacing-panel-max` and remains fully visible,
      including its input, at a 700px-tall viewport.

### Preserved from the shell

- [ ] `id="chat"`, `tabIndex={-1}`, `scroll-mt-panel-inset`, the `focus-visible`
      ring, and the `lg:sticky lg:top-panel-inset` behaviour all survive — the
      hero and navbar CTAs jump here and must still move focus, not just the
      viewport.

### Styling

- [ ] The agent-bubble tint is a new `@theme` token in `globals.css` sampled from
      the mockup (`#e6eeea`); `--color-brand`, `--color-on-brand`, `--color-ink`,
      `--color-muted`, and `--color-band-strong` are reused, not redefined.
- [ ] No horizontal overflow at 375px, 1024px, or 1440px; long bubble text wraps
      rather than stretching the panel.

### Housekeeping

- [ ] `ChatPanel` no longer imports `Placeholder`. If this ships after
      Featured Properties, `Placeholder.tsx` is deleted along with its last usage
      and the `Placeholder` import in any test.
- [ ] `ChatPanel` is added to `BUILT_REGIONS` in
      `tests/scope-boundaries.test.tsx`, and the stale chat-panel placeholder
      assertions in `tests/regions.test.tsx` are updated rather than weakened.
- [ ] A `tests/chat-panel.test.tsx` covers: the four seeded turns render in order
      with the right speaker, the header name and status, three chips, the input
      and send button both present and disabled, and that `id="chat"` +
      `tabIndex={-1}` survive.
- [ ] `pnpm build` and `pnpm test` pass from `frontend/`.

## Out of Scope

- **Any real chat.** No `POST /chat`, no local echo, no canned replies on send,
  no typing indicator, no streaming, no message persistence. The user explicitly
  chose fully static markup.
- **Chip click behaviour.** Chips render; they do nothing.
- **Property cards inside messages.** The agent describes listings in prose only.
- **Lead capture UI.**
- **Mobile drawer / floating chat bubble.** Below `lg` the panel stays in normal
  flow after the grid, as it does today.
- **Markdown or rich text in bubbles.** Plain strings.
- **Dark mode.**

## Edge Cases

- **Short viewport (≈700px tall).** The sticky panel must not exceed the viewport
  or hide its own input — `--spacing-panel-max` already exists for this; the
  message list absorbs the squeeze.
- **Below `lg`.** No sticky, no height cap; the panel sits in flow at its natural
  height and the message list does not need its own scrollbar.
- **Long bubble text.** Wraps within the 85% cap; a single unbroken long token
  (a URL) must not force horizontal overflow.
- **Keyboard.** The disabled input and buttons are skipped in tab order, which is
  correct while they're inert; the `#chat` jump still lands focus on the panel via
  `tabIndex={-1}`.
- **Reduced motion.** Nothing animates — no auto-scroll, no typing dots.

## Notes

- Colours sampled from `context/ui-interface.png`: agent bubble `#e6eeea`
  (three independent samples agreed), header band `#e4e4e2` (exactly the existing
  `--color-band-strong`), user bubble and avatar `#2c4a3e` (existing
  `--color-brand`).
- The seed conversation is the mockup's, lightly kept: Colombo 5 under LKR 50M →
  Havelock Town 3-bed at LKR 48M → anything in Galle → Galle Fort colonial retreat
  at LKR 130M. It's illustrative copy, consistent with the fixture listings in the
  Featured Properties feature.
- Chips: `3-bedroom homes in Colombo under LKR 50M`, `Beachside properties in
  Galle`, `What's trending in Rajagiriya?`
- The `lg` message-list collapse was flagged in the Site Header retro as
  pre-existing and explicitly left for this feature — it is a criterion here, not
  scope creep.
- jsdom applies no Tailwind and has no layout engine, so sticky behaviour, the
  `lg` height fix, the short-viewport case, and bubble wrapping are
  browser-verified. Tests cover text, roles, order, and disabled state.
