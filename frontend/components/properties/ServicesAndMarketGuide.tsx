"use client";

import { useState, type FormEvent } from "react";
import { captureFallbackLead } from "@/lib/api";

const SparkleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3.5 shrink-0"
  >
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

const HomeIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0 text-brand"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ScaleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0 text-brand"
  >
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);

const HammerIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0 text-brand"
  >
    <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" />
    <path d="M17.64 15 22 10.64" />
    <path d="m20.91 3.26-1.25-1.25a2.12 2.12 0 0 0-3 0l-4.5 4.5 4.25 4.25 4.5-4.5a2.12 2.12 0 0 0 0-3Z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

function sendBriefToChat(brief: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>("#chat textarea");
  if (textarea) {
    textarea.value = brief;
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const chatRegion = document.getElementById("chat");
  if (chatRegion) {
    chatRegion.scrollIntoView({ behavior: "smooth" });
  }
}

export default function ServicesAndMarketGuide() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmitLead = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!phone.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(false);
    try {
      await captureFallbackLead({
        sessionId: crypto.randomUUID(),
        name: name.trim(),
        phone: phone.trim(),
      });
      setIsSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="featured-properties"
      aria-labelledby="featured-properties-heading"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand uppercase">
            <SparkleIcon />
            Bespoke Brokerage & Advisory
          </span>
          <span className="text-xs text-muted">Islandwide Reach</span>
        </div>

        <h2
          id="featured-properties-heading"
          className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight text-ink font-bold"
        >
          Full-Service Property Advisory Across Sri Lanka
        </h2>

        <p className="text-sm leading-relaxed text-muted max-w-2xl">
          Whether you are looking to buy, list a property for sale, verify title deeds, or oversee a
          turnkey renovation, our advisory team guides you from initial inquiry to final handover.
        </p>
      </div>

      {/* 3 Minimal Visual Pillar Cards */}
      <div className="flex flex-col gap-4">
        {/* Pillar 1: Sourcing & Sales */}
        <div className="group rounded-2xl border border-neutral-200/90 bg-surface p-5 sm:p-6 transition-all hover:border-brand/40 hover:shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-brand/10">
                  <HomeIcon />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Islandwide Brokerage & Sourcing
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-ink">
                Buying, Selling & Private Matching
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-xl">
                We represent motivated sellers to connect with vetted local and diaspora buyers, while
                sourcing unlisted apartments, residential land, and houses across Colombo and key regions.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                sendBriefToChat("I'm looking to buy or sell a property in Sri Lanka. How can you assist?")
              }
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-on-brand cursor-pointer self-start sm:self-center"
            >
              <span>Chat with Amaya</span>
              <ArrowRightIcon />
            </button>
          </div>
        </div>

        {/* Pillar 2: Legal & Conveyancing */}
        <div className="group rounded-2xl border border-neutral-200/90 bg-surface p-5 sm:p-6 transition-all hover:border-brand/40 hover:shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-brand/10">
                  <ScaleIcon />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Protecting Your Capital
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-ink">
                Title Due Diligence & Conveyancing
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-xl">
                Independent 30-year Land Registry deed searches, sales agreement drafting, and municipal
                council clearances through our panel of licensed attorneys before you commit an advance.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                sendBriefToChat("I have a property deed or title that needs legal verification before placing an advance.")
              }
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-on-brand cursor-pointer self-start sm:self-center"
            >
              <span>Consult on Deeds</span>
              <ArrowRightIcon />
            </button>
          </div>
        </div>

        {/* Pillar 3: Renovations & Fit-Out */}
        <div className="group rounded-2xl border border-neutral-200/90 bg-surface p-5 sm:p-6 transition-all hover:border-brand/40 hover:shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-brand/10">
                  <HammerIcon />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Project Oversight & Yield
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-ink">
                Turnkey Renovations & Fit-Outs
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-xl">
                Modern interior refurbishments, bathroom/kitchen upgrades, and milestone-supervised
                contractor management—ideal for overseas owners seeking hassle-free execution.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                sendBriefToChat("I would like to discuss renovating an apartment or house in Sri Lanka.")
              }
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-on-brand cursor-pointer self-start sm:self-center"
            >
              <span>Discuss Renovation</span>
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Clean Minimal Callback Card */}
      <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/5 via-surface to-brand/10 p-5 sm:p-6 shadow-xs">
        <div className="max-w-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            Prefer a Direct Call or WhatsApp?
          </span>
          <h3 className="mt-1 font-display text-base sm:text-lg font-bold text-ink">
            Request a Confidential Advisory Call
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
            Leave your number and an advisor will connect with you via WhatsApp or phone.
          </p>

          {isSubmitted ? (
            <div className="mt-3 rounded-xl bg-brand/10 p-3.5 text-xs sm:text-sm text-brand font-medium">
              ✓ Thank you! Your request has been received. Our senior advisor will contact you shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmitLead} className="mt-4 flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                placeholder="Name (Optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-xs text-ink placeholder:text-neutral-400 focus:border-brand focus:outline-none sm:w-1/3"
              />
              <input
                type="tel"
                required
                placeholder="Phone or WhatsApp Number *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-xs text-ink placeholder:text-neutral-400 focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting || !phone.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-on-brand hover:bg-brand/90 disabled:opacity-50 transition cursor-pointer"
              >
                <span>{isSubmitting ? "Sending..." : "Request Call"}</span>
                <ArrowRightIcon />
              </button>
            </form>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-600">
              Could not submit your request. Please message Amaya in the chat or try again.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
