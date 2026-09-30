"use client";

import Container from "@/components/layout/Container";
import { openChat } from "@/lib/chat-dialog";

export default function AskAmayaBanner() {
  return (
    <section className="bg-white py-12 sm:py-16">
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-gradient-to-r from-[#f5f6f4] via-[#fafaf9] to-[#edf2ee] p-6 sm:p-10 shadow-xs">
          {/* Subtle decorative background accent */}
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,var(--color-brand)_0,transparent_70%)]" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Sparkle Icon + Text */}
            <div className="flex items-start gap-4 sm:items-center sm:gap-5">
              <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-2xl bg-white border border-brand/20 shadow-xs text-brand">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6 text-brand"
                  aria-hidden="true"
                >
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                </svg>
              </div>

              <div>
                <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Have a property question?
                </p>
                <h3 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-ink">
                  Ask Amaya.
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-neutral-600">
                  Your AI property assistant is just a message away.
                </p>
              </div>
            </div>

            {/* Right: CTA Button */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => openChat()}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-on-brand shadow-xs transition-all hover:bg-[#233c32]"
              >
                <span>Start a conversation</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
