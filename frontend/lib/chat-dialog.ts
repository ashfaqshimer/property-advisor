/**
 * Lightweight helper to trigger the Amaya chat dialog/drawer from anywhere
 * on the page (Hero search input, prompt tags, CTAs, property cards).
 */
export function openChat(prompt?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("open-amaya-chat", { detail: { prompt } })
    );
  }
}
