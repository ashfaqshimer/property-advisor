# Spec: Featured Properties

> **Superseded copy — historical record.** Where this spec says the brand is
> "Home Advisor", it is now **Property Advisor** (`brand-rename` chore). The rule it was
> making — never use the mockup's "Terra & Co." wording — still stands.

## Goal

Replace the property grid's placeholder skeletons with a real section header and
eight real property cards matching `context/ui-interface.png`. A visitor scrolling
past the hero should see a browsable set of listings — photo, location, name,
price, blurb, and beds/baths/sqft — rendered from a local fixture, since no backend
exists yet.

## Goal state (from the mockup)

```
HANDPICKED FOR YOU                         uppercase, tracked, ~11px
Featured properties                        serif, ~30px, --color-ink
A curated selection across Colombo and     sans, ~14px, --color-muted
the wider island — from city apartments    wraps to 2 lines
to coastal retreats.

┌──────────────────────┐  ┌──────────────────────┐
│ ⌖ Colombo 7          │  │ ⌖ Colombo 5          │  pill: white/90, top-left
│                      │  │                      │
│      [ photo ]       │  │      [ photo ]       │  aspect-4/3, full bleed
│                      │  │                      │
├──────────────────────┤  ├──────────────────────┤
│ Garden Villa   LKR   │  │ Havelock Res.  LKR   │  serif ink + brand-green
│ on Ward Place  185M  │  │                48M   │  price, price never wraps
│ A serene modern      │  │ Light-filled         │  --color-muted, 2 lines
│ villa with mature…   │  │ apartment moments…   │
│ ─────────────────    │  │ ─────────────────    │  hairline divider
│ ⌸ 5 beds ⌷ 4 baths   │  │ ⌸ 3 beds ⌷ 2 baths   │  icon + label, muted
│ ⛶ 4,200 sqft         │  │ ⛶ 1,650 sqft         │
└──────────────────────┘  └──────────────────────┘
```

## Acceptance Criteria

### Data

- [ ] A `Property` type and an eight-item fixture array live in one module
      (e.g. `frontend/lib/properties.ts`), exported and typed — not inlined in
      the component. Fields: `id`, `title`, `location`, `priceLkr` (display
      string, e.g. `LKR 185M`), `description`, `beds`, `baths`, `sqft`,
      `imageUrl`, `imageAlt`.
- [ ] The eight fixtures carry the mockup's listings (Garden Villa on Ward Place,
      Havelock Residences, Courtyard Townhouse, Skyline Penthouse, Restored
      Colonial Retreat, Hillside Bungalow, Poolside Garden House, Beachside
      Terrace House) across Colombo 3/5/7, Rajagiriya, Galle, Kandy, and Mount
      Lavinia.
- [ ] A comment at the top of the fixture module states it is illustrative
      placeholder data to be replaced by `GET /properties`.

### Images

- [ ] Photos are remote Unsplash URLs rendered through `next/image`, with
      `images.remotePatterns` allowing `images.unsplash.com` in
      `frontend/next.config.ts`.
- [ ] Every image has a `sizes` attribute reflecting the real layout (full width
      below `sm`, half the two-thirds column above), so Next doesn't ship a
      1200px file into a ~280px slot.
- [ ] Each image has a descriptive `alt` from the fixture — not the title
      repeated, not empty.

### Section header

- [ ] Renders an eyebrow reading `HANDPICKED FOR YOU` (uppercase + letter-spaced
      via CSS, not typed in caps), an `<h2>` reading `Featured properties` in
      `font-display`, and the subcopy `A curated selection across Colombo and the
      wider island — from city apartments to coastal retreats.` (em dash).
- [ ] The `<h2>` is the section's accessible name — the existing
      `aria-label="Featured properties"` on the `<section>` is removed in favour
      of `aria-labelledby`, so the name isn't declared twice.

### Card

- [ ] `PropertyCard` takes a single `property: Property` prop. No placeholder
      props, no defaults.
- [ ] Card is a non-interactive `<article>` — no link, no button, no hover
      navigation. Detail pages don't exist.
- [ ] Location renders as a pill overlaid on the top-left of the image, with a
      decorative (`aria-hidden`) map-pin icon.
- [ ] Title (serif, `--color-ink`) and price (`--color-brand`, semibold) sit on
      one row; the title wraps onto a second line while the price stays on the
      first and never wraps mid-value.
- [ ] Meta row shows beds, baths, and sqft, each with an `aria-hidden` icon, with
      `sqft` thousands-separated (`4,200 sqft`).
- [ ] Singular/plural is correct: `1 bed` / `2 beds`, `1 bath` / `2 baths`.

### Styling

- [ ] New colours are `@theme` tokens in `globals.css`, sampled from the mockup:
      page surface `#fafaf9`, card surface `#ffffff`. Existing `--color-ink`,
      `--color-muted`, and `--color-brand` are reused, not redefined.
- [ ] `body` gets the page surface background, so white cards read as raised.
- [ ] Cards are two-up from `sm` and stay two-up inside the `lg` column, matching
      the current grid; no horizontal overflow at 375px or 1440px.

### Housekeeping

- [ ] `PropertyGrid` and `PropertyCard` no longer import `Placeholder`;
      `PLACEHOLDER_CARD_COUNT` is gone. `Placeholder.tsx` itself stays — the chat
      panel still uses it.
- [ ] `PropertyGrid` is added to `BUILT_REGIONS` in
      `tests/scope-boundaries.test.tsx`, and the stale property-grid placeholder
      assertions in `tests/regions.test.tsx` are updated rather than weakened.
- [ ] A `tests/property-card.test.tsx` (or similar) covers: heading level and
      text, price rendering, plural/singular meta, alt text present, and that the
      grid renders one article per fixture.
- [ ] `pnpm build` and `pnpm test` pass from `frontend/`.

## Out of Scope

- **Backend / API.** No `GET /properties`, no fetching, no loading states.
- **Filters, sort, search, pagination, "view all".** The grid renders all eight.
- **Property detail pages** and any card link or hover affordance.
- **Real listing photos.** Unsplash URLs are stand-ins; they get replaced when
  real listings exist.
- **Chat panel.** Its own feature, tracked separately.
- **Web fonts.** `font-display` stays the system serif stack until the typography
  feature lands.
- **Dark mode.**

## Edge Cases

- **Long titles.** "Garden Villa on Ward Place" wraps to two lines in the narrow
  `lg` column — the price must not be pushed off or wrapped. Cards in a row stay
  equal height regardless.
- **Image fails to load / offline dev.** The card must not collapse — the image
  slot holds its `aspect-4/3` box and the tinted background shows through, so the
  layout survives a dead Unsplash URL.
- **Narrow viewport (375px).** Single column; the meta row wraps rather than
  overflowing.
- **Odd card counts.** The grid must not assume an even number — dropping a
  fixture leaves a clean trailing gap, not a stretched card.
- **Screen readers.** Icons are decorative; meta reads as "5 beds, 4 baths,
  4,200 sqft" from the text alone.

## Notes

- Colours sampled from `context/ui-interface.png`, not eyeballed — same rule as
  the hero. Card title reads `#1a1a1a` (existing `--color-ink`); the price samples
  green-tinted (`#505d47` through 5px antialiasing) and is specced as
  `--color-brand` `#2c4a3e`.
- The eyebrow's two words sample within noise of each other
  (`#5f6f6d` vs `#697c80` at 5px), so it is specced as **one** muted colour.
  If the intended design is a two-tone eyebrow, that's a deliberate follow-up,
  not a bug here.
- Brand is **Home Advisor**; the mockup's listings, prices, and "Terra & Co."
  wording are illustrative reference art. See the Branding section of `CLAUDE.md`.
- jsdom applies no Tailwind and has no layout engine, so the two-up grid,
  equal-height rows, 375px/1440px, and `next/image` sizing are browser-verified.
  Tests cover text, roles, heading level, and alt text.
