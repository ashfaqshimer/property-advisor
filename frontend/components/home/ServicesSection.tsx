"use client";

import Container from "@/components/layout/Container";
import { openChat } from "@/lib/chat-dialog";

const SERVICES = [
  {
    id: "brokerage",
    badge: "Island-wide Brokerage",
    title: "Buying, Selling & Private Matching",
    description:
      "We represent motivated sellers and connect them with vetted local and diaspora buyers, while discreetly sourcing unlisted apartments, residential land, and private villas across Colombo and premier coastal areas.",
    actionLabel: "Find or List a Property",
    prompt: "I am interested in buying or listing a property in Sri Lanka. Can you guide me through current options and process?",
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
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      </svg>
    ),
  },
  {
    id: "legal-deeds",
    badge: "Protecting Your Capital",
    title: "Title Due Diligence & Conveyancing",
    description:
      "Independent 30-year Land Registry deed searches, sales agreement drafting, boundary survey checks, and municipal clearances handled through licensed conveyancing attorneys before you commit an advance.",
    actionLabel: "Consult on Deeds",
    prompt: "I have a property deed or title that needs legal verification before placing an advance. How can your legal panel assist?",
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
    id: "renovation",
    badge: "Project Oversight & Yield",
    title: "Turnkey Renovations & Fit-Outs",
    description:
      "Modernizing older Colombo residences and high-rise apartments with curated interior fit-outs, vetted contractor management, and architectural oversight designed to command premium rental yield.",
    actionLabel: "Discuss Renovations",
    prompt: "I want to discuss a turnkey renovation and interior fit-out for my property in Sri Lanka to improve its market value and rental yield.",
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
        <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" />
        <path d="M17.64 15 22 10.64" />
        <path d="m20.91 3.26-1.25-1.25a2.12 2.12 0 0 0-3 0l-4.5 4.5 4.25 4.25 4.5-4.5a2.12 2.12 0 0 0 0-3Z" />
      </svg>
    ),
  },
];

export default function ServicesSection() {
  const handleServiceInquiry = (prompt: string) => {
    openChat(prompt);
  };

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="scroll-mt-20 border-b border-neutral-200/80 bg-white py-16 sm:py-24"
    >
      <Container>
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
            BESPOKE BROKERAGE &amp; ADVISORY
          </p>

          <h2
            id="services-heading"
            className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl max-w-3xl"
          >
            Full-Service Real Estate Advisory Across Sri Lanka
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            Whether you are buying, listing a property, verifying 30-year deed history,
            or managing an interior fit-out, our advisory team guides you from inquiry to handover.
          </p>
        </div>

        {/* 3 Pillar Cards */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {SERVICES.map((service) => (
            <div
              key={service.id}
              className="group flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-[#fbfbfa] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:bg-white hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-white border border-neutral-200/60 shadow-2xs group-hover:border-brand/30 transition-colors">
                    {service.icon}
                  </div>
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand uppercase">
                    {service.badge}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold leading-snug text-ink group-hover:text-brand transition-colors">
                  {service.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {service.description}
                </p>
              </div>

              <div className="mt-8 border-t border-neutral-200/60 pt-5">
                <button
                  type="button"
                  onClick={() => handleServiceInquiry(service.prompt)}
                  className="group/btn inline-flex w-full cursor-pointer items-center justify-between rounded-xl bg-white border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-2xs transition-all hover:bg-brand hover:border-brand hover:text-white"
                >
                  <span>{service.actionLabel}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
