/**
 * Lightweight helper to trigger the Amaya chat dialog/drawer from anywhere
 * on the page (Hero search input, prompt tags, CTAs, property cards).
 */
export type OpenChatOptions = {
  prompt?: string;
  initialMessage?: string;
  suggestionChips?: string[];
};

export function openChat(options?: string | OpenChatOptions) {
  if (typeof window !== "undefined") {
    const detail: OpenChatOptions =
      typeof options === "string" ? { prompt: options } : options || {};
    window.dispatchEvent(
      new CustomEvent("open-amaya-chat", { detail })
    );
  }
}
