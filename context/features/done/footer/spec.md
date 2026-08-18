# Spec: Footer

> **Superseded copy — historical record.** This spec shipped when the brand was
> "Home Advisor". The `brand-rename` chore renamed it to **Property Advisor**, so the
> wordmark, copyright line, and email below now read "Property Advisor" and
> `hello@propertyadvisor.lk`. Criteria left as written to preserve what was agreed at
> the time; `CLAUDE.md` is authoritative on the brand.

## Goal

Replace the four `Placeholder` stubs in `frontend/components/layout/Footer.tsx`
with the real footer from [context/ui-interface.png](../../ui-interface.png):
a brand column with blurb, a contact column, a follow column, and a bottom
copyright bar. First region of the layout shell to get real content.

## Assumptions / Preconditions

- Brand name is **Home Advisor** — the mockup's "Terra & Co." is placeholder
  art and is not used anywhere in the code. Contact details are adapted to
  match (`hello@homeadvisor.lk`); the phone number and street address are taken
  from the mockup verbatim as illustrative prototype data.
- Existing structure stays: `<footer>` wrapping a shared `Container`, the same
  grid shape (brand spans 2 of 4 columns at `lg`, contact and follow take one
  each), and a separated bottom bar.
- `Placeholder.tsx` is **not** deleted — the navbar, hero, grid, and chat panel
  still use it. It is only removed once the last region is built.
- Typography is whatever the app currently inherits. Wiring up `next/font` and
  the mockup's serif display face is a separate global chore.

## Content

Copy is fixed here so it isn't re-invented at implementation time.

| Region | Content |
| --- | --- |
| Brand | Logo mark + wordmark "Home Advisor" |
| Blurb | "Colombo-based, island-wide reach. Thoughtful, AI-guided property search across Sri Lanka." |
| Contact heading | "Contact" (rendered uppercase, letter-spaced) |
| Contact items | `+94 11 200 0000` · `hello@homeadvisor.lk` · `Ward Place, Colombo 7` |
| Follow heading | "Follow" (rendered uppercase, letter-spaced) |
| Follow items | Instagram · Facebook · LinkedIn |
| Bottom bar | "© 2026 Home Advisor — a UI prototype. All imagery is illustrative." |

## Acceptance Criteria

### Shared logo component

- [ ] `frontend/components/layout/Logo.tsx` exists and default-exports a
      component rendering the mark plus the "Home Advisor" wordmark.
- [ ] The mark is drawn with markup/CSS or an inline SVG — no image file is
      added to `frontend/public/`.
- [ ] `Footer.tsx` imports and renders it. `Navbar.tsx` is **not** modified;
      it keeps its placeholder and adopts `Logo` in its own feature.
- [ ] The wordmark is real text (readable by `getByText`), not an image or
      background, so it stays selectable and accessible.

### Footer content

- [ ] `Footer.tsx` imports no `Placeholder`, and `Placeholder` appears nowhere
      in the rendered footer.
- [ ] All seven content rows in the table above render, with that exact copy.
- [ ] "Contact" and "Follow" are `<h2>` elements (the footer's own heading
      level — the page `<h1>` lives in the hero), each labelling a list of
      links beneath it.
- [ ] Contact and follow items are `<ul>`/`<li>` lists, not loose `<div>`s.
- [ ] The bottom bar is visually separated from the columns above it by a top
      border, and sits inside the same `Container`.

### Links

- [ ] The phone number is an `<a href="tel:+94112000000">`.
- [ ] The email is an `<a href="mailto:hello@homeadvisor.lk">`.
- [ ] The street address is **not** a link — plain text.
- [ ] Instagram, Facebook and LinkedIn are `<a href="#">` placeholders, each
      carrying a `TODO` comment noting the real URL is pending.
- [ ] Every link has a visible `hover:` state and a focus-visible ring, so
      keyboard navigation is not silent.

### Layout

- [ ] The footer keeps its existing full-bleed band styling (top border, tinted
      background) and aligns to `max-w-page` via `Container`.
- [ ] Grid is single column below `sm`, two columns at `sm`, four at `lg` with
      the brand column spanning two — matching the current stub's shape.
- [ ] No horizontal overflow at 375px width.

### Tests

- [ ] A `frontend/tests/footer.test.tsx` covers: wordmark text renders; both
      section headings render as headings; contact and follow lists render with
      the expected number of items; `tel:`/`mailto:` hrefs are correct; the
      address is not a link; copyright text renders; no `Placeholder` dashed
      border remains in the footer subtree.
- [ ] Existing tests in `frontend/tests/` still pass — in particular
      `scope-boundaries.test.tsx`, which asserts the shell is content-free and
      will need updating now that the footer legitimately has links and
      headings. Update it rather than deleting the assertions: narrow its scope
      to the regions that are still placeholders.
- [ ] `pnpm build` and `pnpm test` both pass from `frontend/`.

## Out of Scope

- Navbar, hero, property grid, and chat panel — still placeholders.
- Deleting `Placeholder.tsx`.
- `next/font` setup and the serif display face.
- Real destinations for the social links, and any social icons (text labels
  only, as in the mockup).
- A newsletter signup, sitemap, or legal/privacy pages.
- Dark mode.
- Making the footer's contact details configurable via env vars or a CMS —
  hardcoded is correct at this stage.

## Edge Cases

- **375px width** — the four-column grid must collapse to one column with no
  overflow; the email address is the longest unbreakable-ish string, so it must
  wrap or shrink rather than push the page wide.
- **Long-press / right-click on `tel:` on desktop** — acceptable that it does
  nothing useful; not worth guarding against.
- **Placeholder social links** — `href="#"` jumps to the top of the page on
  click. Accepted for the prototype, and the reason each carries a TODO.
- **jsdom cannot verify the grid** — column counts and the 375px check are
  browser-only. Tests assert structure and class presence as deletion guards;
  any class assertion says so in a comment, per the repo's testing note.

## Notes

- Design reference: [context/ui-interface.png](../../ui-interface.png), bottom
  band. The mockup's brand ("Terra & Co.") is deliberately not carried over.
- The mockup shows contact rows with small leading icons. Rendering them is
  optional here — if included they must be inline SVG marked
  `aria-hidden="true"`, since the adjacent text already names the field.
