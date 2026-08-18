import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ChatPanel from "@/components/chat/ChatPanel";
import Footer from "@/components/layout/Footer";
import PropertyGrid from "@/components/properties/PropertyGrid";

// The property grid is no longer a placeholder region — its header, cards, and
// fixture data are covered by `property-grid.test.tsx`. Only its place in the
// shell is asserted here, alongside the other regions' layout guards.
describe("PropertyGrid", () => {
  it("is the target of the header's Listings link", () => {
    render(<PropertyGrid />);
    const section = screen.getByRole("region", { name: "Featured properties" });

    expect(section).toHaveAttribute("id", "featured-properties");
    // Class guard: without it an anchor jump parks the section flush against
    // the top edge. jsdom cannot verify the resulting offset.
    expect(section).toHaveClass("scroll-mt-24");
  });
});

// The chat panel is no longer a placeholder region — its header, seeded turns,
// chips, and input are covered by `chat-panel.test.tsx`. Only its behaviour as a
// column of the shell is asserted here.
describe("ChatPanel", () => {
  it("caps its height and scrolls the message region when sticky", () => {
    render(<ChatPanel />);

    // Class-presence guards. A sticky box taller than the viewport can never
    // scroll to its own bottom, so losing either of these silently breaks the
    // panel at `lg`. Real behaviour is browser-verified, not asserted here.
    expect(screen.getByRole("region", { name: "AI agent chat" })).toHaveClass(
      "lg:sticky",
      "lg:top-panel-inset",
      "lg:max-h-panel-max",
    );
    // `lg:flex-1` is what gives the list the leftover space to scroll inside;
    // without it the panel grew past its cap and hid its own input.
    expect(
      screen.getByRole("list", { name: "Conversation with Amaya" }),
    ).toHaveClass("lg:overflow-y-auto", "lg:flex-1");
  });

  it("keeps the header, chips, and input from absorbing the squeeze", () => {
    render(<ChatPanel />);
    const panel = screen.getByRole("region", { name: "AI agent chat" });

    // Every direct child except the message list must be `shrink-0`, or a short
    // viewport compresses the input instead of the conversation.
    for (const child of Array.from(panel.children)) {
      if (child.tagName === "UL") continue;
      expect(child).toHaveClass("shrink-0");
    }
  });
});

// Navbar's own tests live in `navbar.test.tsx` — content, links, and the mobile
// menu. Only its place in the shell is asserted here.

// The footer is no longer a placeholder region — its content, links, and
// headings are covered by `footer.test.tsx`. Only its grid shape is asserted
// here, alongside the other regions' layout guards.
describe("Footer", () => {
  it("is the target of the header's Contact link", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");

    expect(footer).toHaveAttribute("id", "contact");
    // Class guard: without it an anchor jump parks the footer flush against the
    // top edge. jsdom cannot verify the resulting offset.
    expect(footer).toHaveClass("scroll-mt-24");
  });

  it("gives the brand column double width so the row reads as three columns", () => {
    render(<Footer />);

    // Class-presence guard, not a layout assertion — jsdom computes no columns.
    const brand = within(screen.getByRole("contentinfo"))
      .getByText("Property Advisor")
      .closest("div");

    expect(brand).toHaveClass("lg:col-span-2");
  });
});
