import type { Metadata } from "next";
import Link from "next/link";

import Container from "@/components/layout/Container";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ChatDialog from "@/components/chat/ChatDialog";
import LandAreaConverter from "@/components/tools/LandAreaConverter";

export const metadata: Metadata = {
  title: "Sri Lanka Land Area Converter: Perches to Sq Ft, Acres & Price Calculator | Property Advisor",
  description:
    "Free Sri Lankan land area converter tool. Convert Perches to Square Feet (sq ft), Acres, Roods, and Square Meters. Calculate total land value and effective rate per sq ft.",
  alternates: {
    canonical: "/tools/area-converter",
  },
  openGraph: {
    title: "Sri Lanka Land Area Converter: Perches to Sq Ft & Price Calculator",
    description:
      "Instant real estate land measurement converter for Sri Lanka. Convert between Perches, Sq Ft, Acres, and calculate land values.",
    url: "/tools/area-converter",
    type: "website",
    images: [
      {
        url: "/images/hero_apartment.jpg",
        alt: "Sri Lanka Land Area Converter Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sri Lanka Land Area Converter: Perches to Sq Ft & Price Calculator",
    description: "Convert perches to square feet, acres, and roods with instant price estimation.",
    images: ["/images/hero_apartment.jpg"],
  },
};

export default function AreaConverterPage() {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Sri Lanka Land Area Converter & Rate Calculator",
    url: `${siteUrl}/tools/area-converter`,
    description:
      "Online calculator converting Sri Lankan Perches to Square Feet, Acres, and Roods with price rate estimation.",
    applicationCategory: "UtilityApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "LKR",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How many square feet is 1 perch in Sri Lanka?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "In Sri Lanka, 1 Perch equals exactly 272.25 square feet (25.2929 square meters).",
        },
      },
      {
        "@type": "Question",
        name: "How many perches are in 1 acre of land?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "There are exactly 160 Perches in 1 Acre of land in Sri Lanka (equal to 43,560 square feet).",
        },
      },
      {
        "@type": "Question",
        name: "What is a rood in Sri Lankan land measurement?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A Rood is a traditional British imperial unit used in historical Sri Lankan deeds. 1 Rood equals 40 Perches (0.25 of an acre or 10,890 square feet).",
        },
      },
    ],
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-surface-subtle py-8 sm:py-12">
        {/* Structured Data Scripts */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />

        <Container className="space-y-10">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-brand transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-neutral-500">Tools</span>
            <span>/</span>
            <span className="text-neutral-800 font-medium">Land Area Converter</span>
          </nav>

          {/* Header */}
          <header className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              Free Real Estate Utility
            </span>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink">
              Sri Lanka Land Area &amp; Price Converter
            </h1>
            <p className="text-base text-neutral-600 max-w-2xl leading-relaxed">
              Convert Perches to Square Feet, Acres, and Roods. Calculate overall property cost and unit rates according to official Sri Lankan land measurement conventions.
            </p>
          </header>

          {/* Interactive Tool */}
          <LandAreaConverter />

          {/* Educational Conversion Reference Table */}
          <section className="rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-10 shadow-xs space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-ink">
              Official Sri Lanka Land Measurement Reference Table
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-600">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Perches Equivalent</th>
                    <th className="px-4 py-3">Square Feet (Sq Ft)</th>
                    <th className="px-4 py-3">Square Meters (m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-ink">1 Perch</td>
                    <td className="px-4 py-3">1.0 P</td>
                    <td className="px-4 py-3">272.25 sq ft</td>
                    <td className="px-4 py-3">25.29 m²</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-ink">1 Rood</td>
                    <td className="px-4 py-3">40.0 P</td>
                    <td className="px-4 py-3">10,890 sq ft</td>
                    <td className="px-4 py-3">1,011.7 m²</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-ink">1 Acre</td>
                    <td className="px-4 py-3">160.0 P</td>
                    <td className="px-4 py-3">43,560 sq ft</td>
                    <td className="px-4 py-3">4,046.8 m²</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-ink">1 Hectare</td>
                    <td className="px-4 py-3">395.36 P</td>
                    <td className="px-4 py-3">107,639 sq ft</td>
                    <td className="px-4 py-3">10,000.0 m²</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </Container>
      </main>
      <Footer />
      <ChatDialog />
    </>
  );
}
