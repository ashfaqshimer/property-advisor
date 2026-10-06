import type { Metadata } from "next";
import Link from "next/link";

import Container from "@/components/layout/Container";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ChatDialog from "@/components/chat/ChatDialog";
import FaqSection from "@/components/home/FaqSection";

export const metadata: Metadata = {
  title: "Real Estate FAQ & Buying Guide | Property Advisor Sri Lanka",
  description:
    "Frequently asked questions on buying, renting, and investing in Sri Lankan real estate. Foreign ownership rules, perch calculations, stamp duty, and AI property advisory.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "Real Estate FAQ & Buying Guide | Property Advisor Sri Lanka",
    description:
      "Frequently asked questions about purchasing property, foreign ownership, land measurements, and legal procedures in Sri Lanka.",
    url: "/faq",
    type: "website",
    images: [
      {
        url: "/images/hero_apartment.jpg",
        alt: "Property Advisor Real Estate FAQ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Real Estate FAQ & Buying Guide | Property Advisor Sri Lanka",
    description: "Learn about foreign ownership, stamp duty, perches, and AI advisory in Sri Lanka.",
    images: ["/images/hero_apartment.jpg"],
  },
};

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-surface-subtle py-8 sm:py-12">
        <Container>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500 mb-6">
            <Link href="/" className="hover:text-brand transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-neutral-800 font-medium">FAQ</span>
          </nav>
        </Container>

        <FaqSection
          className="border-none bg-transparent py-0 sm:py-4"
          heading="Sri Lanka Real Estate Questions & Answers"
          subheading="Clear, verified answers to common questions about buying apartments, land deeds, foreign ownership, and market pricing."
        />
      </main>
      <Footer />
      <ChatDialog />
    </>
  );
}
