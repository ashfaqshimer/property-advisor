"use client";

import { openChat } from "@/lib/chat-dialog";

export default function PropertyInquiryCta({
  propertyId,
  title,
  location,
  price,
}: {
  propertyId: string;
  title: string;
  location: string;
  price: string;
}) {
  const handleInquire = (customPrompt?: string) => {
    const prompt =
      customPrompt ||
      `I'm interested in "${title}" in ${location} (${price}). Can you tell me more about it and arrange a viewing?`;
    openChat(prompt);
  };

  return (
    <div className="rounded-2xl border border-brand/20 bg-emerald-50/50 p-6 sm:p-8 dark:bg-zinc-900/60 dark:border-zinc-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand dark:bg-emerald-950/60 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
            24/7 AI Real Estate Advisor
          </span>
          <h3 className="mt-2 text-xl font-bold text-ink dark:text-zinc-100 sm:text-2xl">
            Interested in this property?
          </h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-zinc-400 max-w-xl">
            Amaya can answer questions about the neighborhood, schedule a viewing, or check pricing benchmarks in {location}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleInquire()}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#233c32] active:scale-98 shrink-0"
        >
          <span>Ask Amaya about this listing</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="mt-5 border-t border-brand/15 pt-4 dark:border-zinc-800">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Quick questions for Amaya:</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {[
            `Is the price for ${title} negotiable?`,
            `What are the nearby transport & schools in ${location}?`,
            `Show me similar properties in ${location}`,
            `Schedule a visit for ${title}`,
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleInquire(prompt)}
              className="inline-flex cursor-pointer items-center rounded-lg border border-neutral-200/80 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-2xs transition-colors hover:border-brand/40 hover:bg-neutral-50 hover:text-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-emerald-600"
            >
              &ldquo;{prompt}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
