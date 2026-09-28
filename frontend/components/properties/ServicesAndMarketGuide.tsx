"use client";

import { useState, type FormEvent } from "react";
import { captureFallbackLead } from "@/lib/api";

type TabKey = "sourcing" | "legal" | "renovations";

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

const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
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
    className="size-4 shrink-0"
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
    className="size-4 shrink-0"
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

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3.5 shrink-0 text-brand"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function sendBriefToChat(brief: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>("#chat textarea");
  if (textarea) {
    textarea.value = brief;
    textarea.focus();
    // Dispatch input event so any listeners update state
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const chatRegion = document.getElementById("chat");
  if (chatRegion) {
    chatRegion.scrollIntoView({ behavior: "smooth" });
  }
}

export default function ServicesAndMarketGuide() {
  const [activeTab, setActiveTab] = useState<TabKey>("sourcing");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("Property Sourcing");
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
        name: `${name.trim()} [Interested in: ${service}]`,
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
          <span className="text-xs text-muted">Colombo & Islandwide</span>
        </div>

        <h2
          id="featured-properties-heading"
          className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight text-ink font-bold"
        >
          Curated Sourcing, Legal Due Diligence & Renovations
        </h2>

        <p className="text-sm leading-relaxed text-muted max-w-2xl">
          Most prime properties in Colombo 3, 7, and suburban corridors trade privately off-market.
          Beyond matchmaking, our advisory team conducts exhaustive deed verifications and manages
          turnkey interior refurbishments under one roof.
        </p>
      </div>

      {/* Service Pillar Tabs */}
      <div className="flex rounded-xl bg-band p-1.5 gap-1 overflow-x-auto scrollbar-subtle">
        <button
          type="button"
          onClick={() => setActiveTab("sourcing")}
          className={`flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition cursor-pointer ${
            activeTab === "sourcing"
              ? "bg-surface text-brand shadow-xs font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <SearchIcon />
          <span>Property Sourcing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("legal")}
          className={`flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition cursor-pointer ${
            activeTab === "legal"
              ? "bg-surface text-brand shadow-xs font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <ScaleIcon />
          <span>Legal & Deeds</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("renovations")}
          className={`flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition cursor-pointer ${
            activeTab === "renovations"
              ? "bg-surface text-brand shadow-xs font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <HammerIcon />
          <span>Renovations</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="rounded-2xl border border-neutral-200/90 bg-surface p-5 sm:p-7 shadow-xs">
        {activeTab === "sourcing" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                Off-Market & Private Inventory
              </span>
              <h3 className="font-display text-lg sm:text-xl font-bold text-ink">
                Colombo Market Benchmarks & Sourcing Profiles
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                We partner directly with property owners and private investor networks. Choose a
                profile below to brief Amaya on matching active stock.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Profile 1 */}
              <div className="flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-page p-4 transition-all hover:border-brand/40 hover:shadow-2xs">
                <div>
                  <div className="inline-block rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    Colombo 3 & 7
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-ink">City Apartments & Penthouses</h4>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    2–3 Bed • 1,350–2,100 sq.ft. Pool, 24/7 generator, prime school/diplomatic zones.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-brand">
                    Typ. 55M – 95M LKR
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    sendBriefToChat("I'm looking for a luxury apartment in Colombo 3 or 7. What can you source?")
                  }
                  className="mt-4 flex items-center justify-between text-xs font-medium text-brand hover:underline cursor-pointer"
                >
                  <span>Request matching units</span>
                  <ArrowRightIcon />
                </button>
              </div>

              {/* Profile 2 */}
              <div className="flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-page p-4 transition-all hover:border-brand/40 hover:shadow-2xs">
                <div>
                  <div className="inline-block rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    Rajagiriya & Suburbs
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-ink">Family Houses & Residential Land</h4>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    3–5 Bed • 8–15 Perches. Quiet residential gated enclaves with private gardens.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-brand">
                    Typ. 65M – 130M LKR
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    sendBriefToChat("I'm looking for a house or land in Rajagiriya or Battaramulla.")
                  }
                  className="mt-4 flex items-center justify-between text-xs font-medium text-brand hover:underline cursor-pointer"
                >
                  <span>Request matching units</span>
                  <ArrowRightIcon />
                </button>
              </div>

              {/* Profile 3 */}
              <div className="flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-page p-4 transition-all hover:border-brand/40 hover:shadow-2xs">
                <div>
                  <div className="inline-block rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    Southern Coast
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-ink">Boutique Villas & Beachside Land</h4>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    Galle, Thalpe, Weligama. High-performing holiday rental assets & coastal plots.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-brand">
                    Typ. 45M – 160M LKR
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    sendBriefToChat("I'm interested in coastal land or villas in Galle and the South Coast.")
                  }
                  className="mt-4 flex items-center justify-between text-xs font-medium text-brand hover:underline cursor-pointer"
                >
                  <span>Request matching units</span>
                  <ArrowRightIcon />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink">Selling or Renting Out Your Property?</p>
                <p className="text-xs text-muted">
                  Connect directly with verified diaspora and local buyers without public listing spam.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  sendBriefToChat("I want to sell or rent out my property in Colombo. How can you assist?")
                }
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-on-brand hover:bg-brand/90 transition cursor-pointer"
              >
                <span>List With Us</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}

        {activeTab === "legal" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                Title Due Diligence & Conveyancing
              </span>
              <h3 className="font-display text-lg sm:text-xl font-bold text-ink">
                Protecting Your Real Estate Capital Before You Commit
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Flawed title pedigrees and unverified deeds are the primary source of real estate
                disputes in Sri Lanka. Our licensed legal counsel and notaries verify every document
                prior to advances or deed transfers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">30-Year Land Registry Search</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Detailed folio extracts, pedigree trace, and encumbrance checks at relevant Land Registries.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">Deed & Agreement Drafting</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Agreement to Sell, Deed of Transfer, and Power of Attorney execution for domestic & overseas clients.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">Municipal Council Clearances</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Street line certificates, non-vesting certificates, building plan approvals, and rates clearance.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">Tax & Stamp Duty Advisory</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Transparent stamp duty calculations and clear structuring of property transaction costs.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Need a title or deed verified before making a financial advance?
              </p>
              <button
                type="button"
                onClick={() =>
                  sendBriefToChat("I have a property deed/title that needs legal verification and pedigree search.")
                }
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-on-brand hover:bg-brand/90 transition cursor-pointer"
              >
                <span>Consult Our Legal Team via Amaya</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}

        {activeTab === "renovations" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                Turnkey Project Management
              </span>
              <h3 className="font-display text-lg sm:text-xl font-bold text-ink">
                Renovations & High-Yield Fit-Outs
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Whether you are upgrading an older Colombo apartment or transforming an ancestral home,
                we manage architects, trusted contractors, and materials on your behalf with milestone oversight.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">Contemporary Interior Makeovers</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Luxury bathrooms, open-concept kitchens, bespoke timber joinery, and modern ambient lighting.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">Rental Yield Maximization</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Strategic styling and furnishing packages optimized for expat, embassy, and corporate tenants.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">Diaspora Remote Oversight</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Transparent milestone-based progress reporting with weekly high-res photo and video walkthroughs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-page p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5"><CheckIcon /></span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ink">Turnkey Handover</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      From demolition to final deep-cleaning, ready for immediate tenant occupancy or private enjoyment.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Have an apartment or house you are planning to refurbish?
              </p>
              <button
                type="button"
                onClick={() =>
                  sendBriefToChat("I would like to discuss renovating an apartment or house in Colombo.")
                }
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-on-brand hover:bg-brand/90 transition cursor-pointer"
              >
                <span>Discuss Renovation with Amaya</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Direct VIP Callback Card */}
      <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/5 via-surface to-brand/10 p-5 sm:p-7 shadow-xs">
        <div className="max-w-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            Prefer a Direct Call or WhatsApp?
          </span>
          <h3 className="mt-1 font-display text-lg sm:text-xl font-bold text-ink">
            Request a Confidential Advisory Consultation
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
            Leave your contact details and our senior broker will get in touch with you via WhatsApp or phone.
          </p>

          {isSubmitted ? (
            <div className="mt-4 rounded-xl bg-brand/10 p-4 text-xs sm:text-sm text-brand font-medium">
              ✓ Thank you! Your request has been received. Our senior advisor will contact you shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmitLead} className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Your Name (Optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-xs text-ink placeholder:text-neutral-400 focus:border-brand focus:outline-none"
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone / WhatsApp Number *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-xs text-ink placeholder:text-neutral-400 focus:border-brand focus:outline-none"
                />
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none cursor-pointer"
                >
                  <option value="Property Sourcing">Property Sourcing</option>
                  <option value="Legal & Title Due Diligence">Legal & Title Due Diligence</option>
                  <option value="Renovations & Fit-Out">Renovations & Fit-Out</option>
                  <option value="Listing a Property">Listing / Selling a Property</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting || !phone.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-on-brand hover:bg-brand/90 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSubmitting ? "Submitting..." : "Request Advisory Contact"}
                  <ArrowRightIcon />
                </button>
                {error && (
                  <p className="text-xs text-red-600">
                    Failed to submit request. Please reach out via chat or try again.
                  </p>
                )}
                <span className="text-[11px] text-muted">
                  Strictly confidential • No unsolicited spam
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
