import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Footer from "@/components/layout/Footer";
import Logo from "@/components/layout/Logo";

/**
 * SCOPE LIMIT: jsdom has no layout engine and does not apply Tailwind. Column
 * counts, the 375px collapse, and the wrap behaviour of the email address are
 * browser-only checks. Everything here is DOM structure, content, and link
 * targets; the one class assertion is a deletion guard and says so.
 */

/** The list under a given column heading. */
function columnList(heading: string): HTMLElement {
  const h = screen.getByRole("heading", { name: heading });
  const list = h.parentElement?.querySelector("ul");
  if (!list) throw new Error(`No list found under the "${heading}" heading`);
  return list as HTMLElement;
}

describe("Logo", () => {
  it("renders the wordmark as real, selectable text", () => {
    render(<Logo />);

    expect(screen.getByText("Property Advisor")).toBeInTheDocument();
  });

  it("adds no image file", () => {
    const { container } = render(<Logo />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("hides the mark from assistive tech so the name is not read twice", () => {
    const { container } = render(<Logo />);

    // The initial sits in an aria-hidden box; only the wordmark is announced.
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe(
      "P",
    );
  });
});

describe("Footer content", () => {
  it("renders the brand wordmark and blurb", () => {
    render(<Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("Property Advisor")).toBeInTheDocument();
    expect(
      within(footer).getByText(/Colombo-based, island-wide reach/),
    ).toBeInTheDocument();
  });

  it("labels each column with a heading", () => {
    render(<Footer />);

    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow" })).toBeInTheDocument();
  });

  it("uses h2 for column headings, since the page h1 lives in the hero", () => {
    render(<Footer />);

    for (const name of ["Contact", "Follow"]) {
      expect(screen.getByRole("heading", { name })).toHaveProperty(
        "tagName",
        "H2",
      );
    }
  });

  it("renders contact and follow as lists, not loose divs", () => {
    render(<Footer />);

    expect(columnList("Contact").querySelectorAll("li")).toHaveLength(3);
    expect(columnList("Follow").querySelectorAll("li")).toHaveLength(3);
  });

  it("renders the copyright line", () => {
    render(<Footer />);

    expect(
      screen.getByText(/© 2026 Property Advisor — a UI prototype/),
    ).toBeInTheDocument();
  });

  it("carries no leftover Placeholder scaffolding", () => {
    const { container } = render(<Footer />);

    // Placeholder marks every region with a dashed border; none should remain.
    expect(container.querySelectorAll(".border-dashed")).toHaveLength(0);
  });
});

describe("Footer links", () => {
  it("makes the phone number callable", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: "+94 11 200 0000" }),
    ).toHaveAttribute("href", "tel:+94112000000");
  });

  it("makes the email address mailable", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: "hello@propertyadvisor.lk" }),
    ).toHaveAttribute("href", "mailto:hello@propertyadvisor.lk");
  });

  it("leaves the street address as plain text", () => {
    render(<Footer />);

    const address = screen.getByText("Ward Place, Colombo 7");
    expect(address.closest("a")).toBeNull();
  });

  it("renders the three social links as pending placeholders", () => {
    render(<Footer />);

    for (const name of ["Instagram", "Facebook", "LinkedIn"]) {
      // href="#" is deliberate — the accounts do not exist yet.
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", "#");
    }
  });

  it("gives every link a hover and focus-visible state", () => {
    const { container } = render(<Footer />);

    const links = Array.from(container.querySelectorAll("a"));
    expect(links).toHaveLength(5); // phone, email, and three social

    // Class-presence guard, not a behavioural assertion — jsdom applies no
    // Tailwind. Catches a link added later without keyboard affordance.
    for (const link of links) {
      expect(link.className).toContain("hover:text-brand");
      expect(link.className).toContain("focus-visible:ring-2");
    }
  });
});
