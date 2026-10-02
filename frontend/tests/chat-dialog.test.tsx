import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatDialog from "@/components/chat/ChatDialog";
import { GREETING } from "@/lib/chat";

const BASE = "http://127.0.0.1:8000";

const streamResponse = (status: number, text: string) => {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(text)];
  let idx = 0;

  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () => {
          if (idx < chunks.length) {
            return { done: false, value: chunks[idx++] };
          }
          return { done: true, value: undefined };
        },
      }),
    },
  } as unknown as Response;
};

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

describe("ChatDialog persistence", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", BASE);
    fetchSpy = vi.fn(async (url: unknown) => {
      if (String(url).endsWith("/health")) return streamResponse(200, "");
      if (String(url).endsWith("/properties/featured")) return jsonResponse(200, []);
      if (String(url).endsWith("/site-configuration")) return jsonResponse(200, {});
      if (String(url).endsWith("/chat")) return streamResponse(200, "Here are some great options.");
      return streamResponse(404, "");
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps the chat panel and existing conversation mounted when closing and reopening", async () => {
    render(<ChatDialog />);

    // Initially modal is closed, but ChatPanel is preserved and inert
    const openButton = screen.getByRole("button", { name: "Open chat with Amaya" });
    expect(openButton).toBeInTheDocument();

    // Open chat
    fireEvent.click(openButton);

    // Send a message
    const input = screen.getByRole("textbox", { name: "Ask Amaya" });
    fireEvent.change(input, { target: { value: "Looking for a villa in Colombo 7" } });
    fireEvent.submit(input.closest("form")!);

    // Wait for the message and reply to be rendered
    expect(await screen.findByText("Looking for a villa in Colombo 7")).toBeInTheDocument();
    expect(await screen.findByText("Here are some great options.")).toBeInTheDocument();

    // Close the modal via the close button
    const closeButton = screen.getByRole("button", { name: "Close chat" });
    fireEvent.click(closeButton);

    // The open button is back
    const reopenButton = screen.getByRole("button", { name: "Open chat with Amaya" });
    expect(reopenButton).toBeInTheDocument();

    // Reopen the modal
    fireEvent.click(reopenButton);

    // Verify the conversation history is still fully intact!
    expect(screen.getByText("Looking for a villa in Colombo 7")).toBeInTheDocument();
    expect(screen.getByText("Here are some great options.")).toBeInTheDocument();
  });

  it("allows starting a new conversation via the reset button", async () => {
    render(<ChatDialog />);

    const openButton = screen.getByRole("button", { name: "Open chat with Amaya" });
    fireEvent.click(openButton);

    const input = screen.getByRole("textbox", { name: "Ask Amaya" });
    fireEvent.change(input, { target: { value: "Hi Amaya" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("Hi Amaya")).toBeInTheDocument();
    expect(await screen.findByText("Here are some great options.")).toBeInTheDocument();

    // Reset button should now be available since conversation has started
    const resetButton = screen.getByRole("button", { name: "Start new conversation" });
    fireEvent.click(resetButton);

    // Conversation returns to initial greeting
    expect(screen.queryByText("Hi Amaya")).not.toBeInTheDocument();
    expect(screen.getByText(GREETING)).toBeInTheDocument();
  });
});
