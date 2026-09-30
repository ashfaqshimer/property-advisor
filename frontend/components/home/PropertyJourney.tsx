"use client";

import Container from "@/components/layout/Container";
import { openChat } from "@/lib/chat-dialog";

const JOURNEY_CARDS = [
  {
    title: "Find",
    description:
      "Discover properties using natural language. No endless scrolling.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 text-brand"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    title: "Understand",
    description:
      "Get answers about locations, prices, amenities and more.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 text-brand"
        aria-hidden="true"
      >
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    ),
  },
  {
    title: "Compare",
    description:
      "See your options side by side and make confident decisions.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 text-brand"
        aria-hidden="true"
      >
        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="M7 21h10" />
        <path d="M12 3v18" />
        <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
      </svg>
    ),
  },
  {
    title: "Connect",
    description:
      "Get in touch with the right agents and sellers, when you're ready.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 text-brand"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function PropertyJourney() {
  return (
    <section
      id="journey"
      aria-labelledby="journey-heading"
      className="scroll-mt-20 border-b border-neutral-200/80 bg-[#fafaf9] py-16 sm:py-24"
    >
      <Container>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Heading, Subtitle, CTA */}
          <div className="flex flex-col lg:col-span-5">
            <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              MORE THAN JUST A SEARCH
            </p>

            <h2
              id="journey-heading"
              className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl"
            >
              Your property journey, in one place.
            </h2>

            <p className="mt-5 text-base leading-relaxed text-neutral-600 sm:text-lg">
              From discovery to decision, Property Advisor helps you every step of
              the way.
            </p>

            <div className="mt-8">
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

          {/* Right Column: 2x2 Grid of Feature Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-7">
            {JOURNEY_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-neutral-100/80 border border-neutral-200/50">
                  {card.icon}
                </div>

                <h3 className="mt-5 text-lg font-bold text-ink">{card.title}</h3>

                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
