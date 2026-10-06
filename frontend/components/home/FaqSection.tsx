"use client";

import { useState } from "react";
import Container from "@/components/layout/Container";
import { openChat } from "@/lib/chat-dialog";

export type FaqItem = {
  question: string;
  answer: string;
};

export const REAL_ESTATE_FAQS: FaqItem[] = [
  {
    question: "Can foreigners and non-residents purchase property in Sri Lanka?",
    answer:
      "Yes. Foreign nationals and non-residents can purchase condominium apartments from the 4th floor upwards with full freehold title ownership. Direct purchase of standalone land or ground-level houses is restricted to 99-year leases, unless transacted through eligible Board of Investment (BOI) registered companies. Amaya can help clarify eligibility for specific properties.",
  },
  {
    question: "How is land measured in Sri Lanka? What is a perch?",
    answer:
      "In Sri Lanka, land area is measured in Perches. Exactly 1 Perch equals 272.25 square feet (approximately 25.29 square meters). 160 Perches equal 1 Acre, and 40 Perches equal 1 Rood. In urban Colombo, apartment sizes are quoted in square feet (sq ft), while houses and land are quoted in perches.",
  },
  {
    question: "What taxes, legal fees, and stamp duty apply when buying property?",
    answer:
      "Buyers typically pay a government Stamp Duty (3% on the first LKR 100,000 and 4% on the balance for freehold title deeds), conveyancing lawyer and title search fees (typically 1%–2% of property value), and nominal local municipal registration charges.",
  },
  {
    question: "How does Amaya AI assist my property search and valuation?",
    answer:
      "Amaya is our 24/7 AI property advisor designed for the Sri Lankan market. You can chat naturally in English, Sinhala, or Singlish with your target budget, commute preferences, or family needs. Amaya matches verified live listings, checks market valuation rates, and connects you directly with our property advisors.",
  },
  {
    question: "What rental yields can property investors expect in Colombo?",
    answer:
      "Gross residential rental yields in prime Colombo neighborhoods (Colombo 03 Kollupitiya, Colombo 04 Bambalapitiya, Colombo 07 Cinnamon Gardens, and Rajagiriya) typically range from 5% to 8% per annum for quality furnished condominiums, supported by continuous diplomatic and corporate tenant demand.",
  },
  {
    question: "How do I list my property for sale or rent with Property Advisor?",
    answer:
      "You can submit your property details to our team or message Amaya directly. Our system extracts and structures your listing details, grades pricing against real market benchmarks, and matches your listing with active buyer requests.",
  },
];

export default function FaqSection({
  className = "",
  heading = "Frequently Asked Questions",
  subheading = "Everything you need to know about buying, renting, and investing in Sri Lankan real estate.",
}: {
  className?: string;
  heading?: string;
  subheading?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleIndex = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: REAL_ESTATE_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className={`scroll-mt-20 border-b border-neutral-200/80 bg-white py-16 sm:py-24 ${className}`}
    >
      {/* Schema.org FAQPage structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
            REAL ESTATE GUIDE &amp; ADVICE
          </p>
          <h2
            id="faq-heading"
            className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl"
          >
            {heading}
          </h2>
          <p className="mt-3 text-base text-neutral-600 sm:text-lg">
            {subheading}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-neutral-200/80 rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 sm:p-6 shadow-xs">
          {REAL_ESTATE_FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={faq.question} className="py-4 first:pt-2 last:pb-2">
                <button
                  type="button"
                  onClick={() => toggleIndex(index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 text-left font-semibold text-base text-ink transition-colors hover:text-brand cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-200/70 text-neutral-700 transition-transform duration-200 ${
                      isOpen ? "rotate-180 bg-brand/10 text-brand" : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="size-4"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-3 text-sm leading-relaxed text-neutral-600 pr-8 animate-in fade-in duration-200">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Ask Amaya prompt card */}
        <div className="mx-auto mt-10 max-w-xl text-center">
          <p className="text-sm text-neutral-500">
            Have a question about a specific neighborhood or legal detail?
          </p>
          <button
            type="button"
            onClick={() => openChat("I have a question about Sri Lankan property laws and purchasing regulations")}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-[#233c32] cursor-pointer"
          >
            <span>Ask Amaya your real estate questions</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </Container>
    </section>
  );
}
