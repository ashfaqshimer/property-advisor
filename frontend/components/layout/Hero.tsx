"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Container from "@/components/layout/Container";
import { openChat } from "@/lib/chat-dialog";

const SUGGESTION_TAGS = [
  "Apartments in Colombo",
  "Family homes",
  "Investment properties",
  "Land",
];

export default function Hero() {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      openChat();
      return;
    }
    openChat(query.trim());
    setQuery("");
  };

  const handleTagClick = (tag: string) => {
    openChat(tag);
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-neutral-200/80 bg-[#f9f9f8]"
    >
      {/* Background Living Room Image with gentle gradient mask */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <Image
          src="/images/hero_apartment.jpg"
          alt="Luxury living room overlooking Colombo skyline"
          fill
          priority
          sizes="100vw"
          className="object-cover object-right-bottom sm:object-center opacity-65 lg:opacity-75"
        />
        {/* Soft gradient wash so left content reads with crisp editorial contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#f9f9f8] via-[#f9f9f8]/90 to-transparent lg:w-3/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f9f9f8] via-transparent to-transparent h-24 bottom-0" />
      </div>

      <Container className="relative py-14 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Heading, Subtitle, Search Input, Suggestions */}
          <div className="flex flex-col lg:col-span-7">
            <p className="text-xs font-semibold tracking-[0.22em] text-neutral-500 uppercase">
              YOUR AI PROPERTY ASSISTANT
            </p>

            <h1
              id="hero-heading"
              className="mt-4 font-display text-4xl leading-[1.12] text-balance text-ink sm:text-5xl lg:text-6xl"
            >
              Find Prime Real Estate in Colombo & Sri Lanka
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              Tell Amaya what you&apos;re looking for. She&apos;ll help you find
              the right property with real options, local insights, and expert
              guidance.
            </p>

            {/* Natural Language Prompt Search Bar */}
            <form
              onSubmit={handleSubmit}
              className="mt-8 flex w-full max-w-xl items-center gap-3 rounded-full border border-neutral-300/80 bg-white/95 px-4 py-2 sm:px-5 sm:py-2.5 shadow-md backdrop-blur-md transition-shadow focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
            >
              {/* Sparkle Icon */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 shrink-0 text-brand"
                aria-hidden="true"
              >
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 3 bedroom apartment in Colombo 03 under 40M..."
                aria-label="Search prompt for property advisor"
                className="w-full bg-transparent text-sm sm:text-base text-ink placeholder:text-neutral-400 focus:outline-none"
              />

              <button
                type="submit"
                aria-label="Ask Amaya"
                className="flex size-9 sm:size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand text-white transition-all hover:bg-[#233c32] active:scale-95"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>

            {/* Try Asking About Pills */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-neutral-600">
                Try asking about:
              </span>
              <div className="flex flex-wrap gap-2">
                {SUGGESTION_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="cursor-pointer rounded-full border border-neutral-300/80 bg-white/80 px-3.5 py-1 text-xs font-medium text-neutral-700 shadow-2xs backdrop-blur-xs transition-colors hover:border-brand/40 hover:bg-white hover:text-brand"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Floating Amaya Chat Card */}
          <div className="flex justify-center lg:col-span-5 lg:justify-end">
            <div
              onClick={() => openChat()}
              className="group relative w-full max-w-sm cursor-pointer rounded-2xl border border-neutral-200/80 bg-white/95 p-5 sm:p-6 shadow-xl backdrop-blur-md transition-all hover:-translate-y-1 hover:shadow-2xl"
            >
              {/* Card Header: Avatar + Title */}
              <div className="flex items-center gap-3.5">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-full ring-2 ring-brand/20">
                  <Image
                    src="/images/amaya_avatar.png"
                    alt="Amaya Perera"
                    width={48}
                    height={48}
                    className="size-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Meet Amaya</h3>
                  <p className="text-xs text-neutral-500">Your property advisor</p>
                </div>
              </div>

              {/* Speech Bubble */}
              <div className="mt-4 rounded-xl bg-neutral-100/70 p-4 text-xs leading-relaxed text-neutral-700 border border-neutral-200/40">
                <p>
                  Hi! I&apos;m Amaya. I can help you find properties, answer your
                  questions and guide you through the process.
                </p>
                <p className="mt-3 font-semibold text-ink">
                  What are you looking for today?
                </p>
              </div>

              <div className="mt-3 flex items-center justify-end text-xs font-semibold text-brand group-hover:underline">
                <span>Start chatting &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
