import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import Container from "@/components/layout/Container";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ChatDialog from "@/components/chat/ChatDialog";
import { Badge } from "@/components/ui/badge";
import PropertyInquiryCta from "@/components/properties/PropertyInquiryCta";
import { CITIES, getLocationBySlug } from "@/lib/locations";
import { getFeaturedProperties, type PropertyApiRecord } from "@/lib/api";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return CITIES.map((city) => ({
    slug: city.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const location = getLocationBySlug(slug);

  if (!location) {
    return {
      title: "Location Not Found | Property Advisor",
    };
  }

  const title = `Properties in ${location.name} — Real Estate & Listings | Property Advisor`;
  const description = `Discover apartments, houses, and land for sale and rent in ${location.name}, Sri Lanka. ${location.description.slice(0, 110)}...`;

  return {
    title,
    description,
    alternates: {
      canonical: `/locations/${location.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/locations/${location.slug}`,
      type: "website",
      images: [
        {
          url: "/images/hero_apartment.jpg",
          alt: `Property in ${location.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/hero_apartment.jpg"],
    },
  };
}

export default async function LocationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const location = getLocationBySlug(slug);

  if (!location) {
    notFound();
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  let allProperties: PropertyApiRecord[] = [];
  try {
    allProperties = await getFeaturedProperties(50);
  } catch {
    // Graceful fallback
  }

  const matchingProperties = allProperties.filter((p) =>
    p.location.toLowerCase().includes(location.name.toLowerCase())
  );

  const otherLocations = CITIES.filter((c) => c.slug !== location.slug);

  // Schema.org BreadcrumbList structured data
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Locations",
        item: `${siteUrl}/#locations`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: location.name,
        item: `${siteUrl}/locations/${location.slug}`,
      },
    ],
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-surface-subtle py-8 sm:py-12">
        {/* Structured Data Script */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />

        <Container className="space-y-10">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-brand transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/#locations" className="hover:text-brand transition-colors">
              Locations
            </Link>
            <span>/</span>
            <span className="text-neutral-800 font-medium">{location.name}</span>
          </nav>

          {/* Location Hero Header */}
          <header className="rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-10 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                {location.district}
              </span>
              <span className="text-xs text-neutral-400">•</span>
              <span className="text-xs text-neutral-500 font-medium">Sri Lanka</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink">
              Real Estate & Properties in {location.name}
            </h1>

            <p className="text-base sm:text-lg text-neutral-600 max-w-3xl leading-relaxed">
              {location.description}
            </p>

            {/* Neighborhood Highlights */}
            <div className="pt-4 border-t border-neutral-100">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Prime Neighborhoods & Corridors:
              </p>
              <div className="flex flex-wrap gap-2">
                {location.highlights.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="size-3 text-brand"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </header>

          {/* Active Listings in this Location */}
          <section aria-labelledby="listings-heading" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="listings-heading" className="font-display text-2xl font-bold text-ink sm:text-3xl">
                  Available Properties in {location.name}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {matchingProperties.length > 0
                    ? `Showing ${matchingProperties.length} active listings in ${location.name}`
                    : `No active public listings currently listed directly under "${location.name}"`}
                </p>
              </div>
            </div>

            {matchingProperties.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {matchingProperties.map((item) => {
                  const priceFormatted = item.price !== null
                    ? `${item.currency || "LKR"} ${item.price.toLocaleString("en-US")}${
                        item.listing_type === "rent" ? " / month" : ""
                      }`
                    : "Price on request";
                  const imageUrl =
                    item.featured_image_url ||
                    (item.image_urls && item.image_urls[0]) ||
                    "/images/apartment_colombo03.jpg";

                  return (
                    <article
                      key={item.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                        <Link
                          href={`/properties/${item.id}`}
                          className="block size-full"
                          aria-label={`View details for ${item.title}`}
                        >
                          <Image
                            src={imageUrl}
                            alt={item.image_alt || item.title}
                            fill
                            sizes="(min-width: 1024px) 33vw, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </Link>
                        <div className="absolute bottom-3 left-3 pointer-events-none">
                          <Badge variant={item.listing_type === "rent" ? "rent" : "sale"}>
                            {item.listing_type === "rent" ? "For Rent" : "For Sale"}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="font-semibold text-base text-ink line-clamp-1 group-hover:text-brand transition-colors">
                          <Link href={`/properties/${item.id}`} className="hover:underline">
                            {item.title}
                          </Link>
                        </h3>

                        <p className="mt-3 font-bold text-base text-ink text-brand">
                          {priceFormatted}
                        </p>

                        <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="size-3.5 shrink-0"
                          >
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{item.location}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center sm:p-12">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-brand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink sm:text-lg">
                  Looking for properties in {location.name}?
                </h3>
                <p className="mt-1 text-sm text-neutral-600 max-w-md mx-auto">
                  Our database is continuously updated with private and off-market opportunities. Chat with Amaya to find upcoming listings.
                </p>
              </div>
            )}
          </section>

          {/* AI Advisor Inquire Component */}
          <PropertyInquiryCta
            propertyId={location.slug}
            title={`Real Estate in ${location.name}`}
            location={location.name}
            price="Custom Search"
          />

          {/* Cross-Link Other Locations for Deep Crawling */}
          <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-ink">Explore Other Prime Locations in Sri Lanka</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {otherLocations.map((other) => (
                <Link
                  key={other.slug}
                  href={`/locations/${other.slug}`}
                  className="group flex flex-col rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5 transition-all hover:border-brand/40 hover:bg-emerald-50/30"
                >
                  <span className="font-semibold text-sm text-ink group-hover:text-brand transition-colors">
                    {other.name}
                  </span>
                  <span className="text-xs text-neutral-500 mt-0.5">{other.district}</span>
                </Link>
              ))}
            </div>
          </section>
        </Container>
      </main>
      <Footer />
      <ChatDialog />
    </>
  );
}
