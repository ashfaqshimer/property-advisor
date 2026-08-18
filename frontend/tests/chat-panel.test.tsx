import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ChatPanel from "@/components/chat/ChatPanel";
import { SEED_CONVERSATION, SUGGESTION_CHIPS } from "@/lib/chat";

/**
 * The panel is deliberately static — no state, no handlers, nothing to fire an
 * event at. So these cover content, order, roles, and the disabled state that
 * keeps it from pretending to work.
 *
 * jsdom applies no Tailwind and has no layout engine, so the sticky behaviour,
 * the `lg` height fix, the short-viewport case, and bubble wrapping are all
 * browser-verified instead. The few class assertions here and in
 * `regions.test.tsx` are deletion guards, not proof that the layout works.
 */

describe("chat panel header", () => {
  it("introduces the agent as Amaya, with her status", () => {
    render(<ChatPanel />);

    // Amaya is the advisor; Property Advisor is the brokerage. The header names
    // her, not the brand — the brand belongs to the navbar and footer.
    expect(screen.getByText("Amaya — AI Advisor")).toBeInTheDocument();
    expect(screen.getByText(/Online · replies instantly/)).toBeInTheDocument();
  });

  it("never uses the mockup's placeholder brand", () => {
    const { container } = render(<ChatPanel />);

    // `context/ui-interface.png` is reference art; its "Terra" wording is not
    // this product's name and must not reach the DOM.
    expect(container.textContent).not.toMatch(/terra/i);
  });
});

describe("chat panel messages", () => {
  it("renders the four seeded turns in order", () => {
    render(<ChatPanel />);
    const turns = within(
      screen.getByRole("list", { name: "Conversation with Amaya" }),
    ).getAllByRole("listitem");

    expect(turns).toHaveLength(4);
    turns.forEach((turn, i) => {
      expect(turn).toHaveTextContent(SEED_CONVERSATION[i].text);
    });
  });

  it("alternates user and agent, and names the speaker in text", () => {
    render(<ChatPanel />);
    const turns = screen.getAllByRole("listitem");

    // Colour and alignment are the only visual cue to who is speaking, and
    // neither is perceivable to a screen reader — hence the visually hidden
    // prefix. Asserting it here is what keeps that from being dropped.
    expect(SEED_CONVERSATION.map((m) => m.role)).toEqual([
      "user",
      "agent",
      "user",
      "agent",
    ]);
    expect(turns[0]).toHaveTextContent(/^You:/);
    expect(turns[1]).toHaveTextContent(/^Amaya:/);
    expect(turns[2]).toHaveTextContent(/^You:/);
    expect(turns[3]).toHaveTextContent(/^Amaya:/);
  });

  it("tints each speaker's bubble from the theme, not a literal colour", () => {
    render(<ChatPanel />);
    const bubble = (index: number) =>
      screen.getAllByRole("listitem")[index].firstElementChild;

    // Deletion guards for the two `@theme` tokens the bubbles depend on.
    expect(bubble(0)).toHaveClass("bg-brand", "text-on-brand");
    expect(bubble(1)).toHaveClass("bg-agent-bubble", "text-ink");
  });
});

describe("chat panel controls", () => {
  it("offers the three suggestion chips, all inert", () => {
    render(<ChatPanel />);

    for (const chip of SUGGESTION_CHIPS) {
      expect(screen.getByRole("button", { name: chip })).toBeDisabled();
    }
    // Chips plus the send button; nothing else should be clickable yet.
    expect(screen.getAllByRole("button")).toHaveLength(
      SUGGESTION_CHIPS.length + 1,
    );
  });

  it("renders a real input and send button, both disabled", () => {
    render(<ChatPanel />);
    const input = screen.getByRole("textbox", {
      name: "Ask Amaya",
    });

    // Real controls so the panel does not look broken, disabled so it cannot
    // pretend to send anything — `POST /chat` does not exist yet.
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute(
      "placeholder",
      "Ask about a neighbourhood, budget, or style…",
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});

describe("chat panel as a jump target", () => {
  it("stays focusable so the hero and navbar CTAs land on it", () => {
    render(<ChatPanel />);
    const panel = screen.getByRole("region", { name: "AI agent chat" });

    expect(panel).toHaveAttribute("id", "chat");
    // Without tabIndex a #chat jump moves the viewport but not keyboard focus.
    expect(panel).toHaveAttribute("tabindex", "-1");
    // Scroll margin matches the sticky inset so the panel lands where it settles.
    expect(panel).toHaveClass("scroll-mt-panel-inset");
  });
});
