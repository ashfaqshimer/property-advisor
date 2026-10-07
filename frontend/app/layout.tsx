import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import JsonLd from "@/components/seo/JsonLd";
import "./globals.css";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Property Advisor | Real Estate Brokerage & Advisory Sri Lanka",
    template: "%s | Property Advisor",
  },
  description:
    "Find prime property in Sri Lanka. Curated brokerage, market advice, and end-to-end guidance with vetted legal and renovation partners. Powered by Amaya AI.",
  keywords: [
    "Property in Sri Lanka",
    "Colombo real estate",
    "Apartments for sale Colombo",
    "Houses for rent Colombo",
    "Sri Lanka property advisor",
    "Colombo 03 apartments",
    "Rajagiriya property",
    "Nugegoda house for sale",
    "Commercial property Colombo",
    "Buy land Sri Lanka",
  ],
  authors: [{ name: "Property Advisor" }],
  creator: "Property Advisor",
  publisher: "Property Advisor",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Property Advisor | Real Estate Brokerage & Advisory Sri Lanka",
    description:
      "Find prime property in Sri Lanka. Curated brokerage, market advice, and end-to-end guidance with vetted legal and renovation partners. Powered by Amaya AI.",
    url: siteUrl,
    siteName: "Property Advisor",
    locale: "en_LK",
    type: "website",
    images: [
      {
        url: "/images/hero_apartment.jpg",
        width: 1200,
        height: 630,
        alt: "Property Advisor | Real Estate Brokerage & Advisory in Sri Lanka",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Property Advisor | Real Estate Brokerage & Advisory Sri Lanka",
    description:
      "Find prime property in Sri Lanka. Curated brokerage, market advice, and end-to-end guidance with vetted legal and renovation partners. Powered by Amaya AI.",
    images: ["/images/hero_apartment.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
        : {}),
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans text-neutral-900 antialiased">
        <JsonLd />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
