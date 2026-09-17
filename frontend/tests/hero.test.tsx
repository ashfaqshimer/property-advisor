import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import Hero from "@/components/layout/Hero";

/**
 * SCOPE LIMIT: jsdom applies no Tailwind and has no layout engine, so nothing
 * here proves the hero *looks* like the mockup. The 375px/1440px behaviour,
 * `text-balance`'s two-line split, and smooth scrolling are browser-only
 * checks. These tests cover copy, roles, and the CTA's wiring.
 */
describe("hero content", () => {
  it("renders the eyebrow, headline, and subcopy from the mockup", () => {
    render(<Hero />);

    expect(
      screen.getByText("Colombo-based · island-wide reach"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Find your next home in Colombo — and beyond",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Your expert real estate partner across Sri Lanka. Whether you want to buy, sell, rent, or just need advice, we are here to help.",
      ),
    ).toBeInTheDocument();
  });

  it("names the section by its own headline", () => {
    render(<Hero />);

    expect(
      screen.getByRole("region", { name: /^Find your next home/ }),
    ).toBeInTheDocument();
  });

  it("keeps the headline on the display face", () => {
    render(<Hero />);

    // A class assertion, not a rendering check — jsdom applies no CSS. This is
    // purely a deletion guard for the --font-display wiring.
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "font-display",
    );
  });
});

describe("hero CTA", () => {
  it("is a link to the chat panel rather than a button", () => {
    render(<Hero />);

    expect(
      screen.getByRole("link", { name: "Chat with our AI Agent" }),
    ).toHaveAttribute("href", "#chat");

    // A <button> here would need JS to do anything and would not survive a
    // failed hydration; the anchor is deliberate.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides the bubble icon from assistive tech", () => {
    const { container } = render(<Hero />);

    // The getByRole name match above is the real proof that the icon adds
    // nothing to the accessible name; this pins down how.
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("points at an element that actually exists on the page", () => {
    const { container } = render(<Home />);

    // Scoped to the hero: the header renders the same shared CTA, so an
    // unscoped query matches more than one link on the full page.
    const hero = container.querySelector<HTMLElement>(
      "section[aria-labelledby='hero-heading']",
    );
    if (!hero) throw new Error("hero section not found");

    const href = within(hero)
      .getByRole("link", { name: "Chat with our AI Agent" })
      .getAttribute("href");

    // Guards the CTA and the ChatPanel `id` against drifting apart — a dead
    // fragment link fails silently in a browser.
    expect(container.querySelector(`${href}`)).toBe(
      screen.getByRole("region", { name: "AI agent chat" }),
    );
  });
});
