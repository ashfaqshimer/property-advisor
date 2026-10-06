import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Container from "@/components/layout/Container";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ChatDialog from "@/components/chat/ChatDialog";
import PropertyInquiryCta from "@/components/properties/PropertyInquiryCta";
import { Badge } from "@/components/ui/badge";
import { getProperty, type PropertyApiRecord } from "@/lib/api";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  let property: PropertyApiRecord | null = null;
  try {
    property = await getProperty(id);
  } catch {
    // If backend is down or property not found
  }

  if (!property) {
    return {
      title: "Property Not Found",
      description: "The requested property listing could not be found.",
    };
  }

  const priceText = `${property.currency || "LKR"} ${property.price.toLocaleString("en-US")}${
    property.listing_type === "rent" ? " / month" : ""
  }`;
  const title = `${property.title} — ${property.location} (${priceText})`;
  const description =
    property.description?.slice(0, 155) ||
    `Explore this ${property.property_type} in ${property.location}. ${priceText}. Consult Amaya AI for verified pricing and viewings.`;
  const imageUrl =
    property.featured_image_url ||
    (property.image_urls && property.image_urls[0]) ||
    "/images/hero_apartment.jpg";

  return {
    title,
    description,
    alternates: {
      canonical: `/properties/${property.id}`,
    },
    openGraph: {
      title,
      description,
      url: `/properties/${property.id}`,
      type: "article",
      images: [
        {
          url: imageUrl,
          alt: property.image_alt || property.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  let property: PropertyApiRecord | null = null;
  try {
    property = await getProperty(id);
  } catch {
    // If backend request fails
  }

  if (!property) {
    notFound();
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  const priceFormatted = `${property.currency || "LKR"} ${property.price.toLocaleString("en-US")}${
    property.listing_type === "rent" ? " / month" : ""
  }`;

  const mainImageUrl =
    property.featured_image_url ||
    (property.image_urls && property.image_urls[0]) ||
    "/images/hero_apartment.jpg";

  const allImages = property.image_urls?.length
    ? property.image_urls
    : [mainImageUrl];

  // Schema.org structured data for RealEstateListing
  const schema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    description: property.description,
    url: `${siteUrl}/properties/${property.id}`,
    datePosted: property.created_at,
    image: allImages,
    offers: {
      "@type": "Offer",
      price: property.price,
      priceCurrency: property.currency || "LKR",
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: property.price,
        priceCurrency: property.currency || "LKR",
        unitText: property.listing_type === "rent" ? "MONTH" : "TOTAL",
      },
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: property.location,
      addressCountry: "LK",
    },
  };

  const amenitiesList = property.amenities
    ? Object.entries(property.amenities)
        .filter(([, active]) => Boolean(active))
        .map(([name]) => name.replace(/_/g, " "))
    : [];

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-surface-subtle py-8 sm:py-12">
        {/* Structured Data Script */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />

        <Container className="space-y-8">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-brand transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/#featured-properties" className="hover:text-brand transition-colors">
              Properties
            </Link>
            <span>/</span>
            <span className="text-neutral-800 font-medium truncate max-w-xs sm:max-w-md">
              {property.title}
            </span>
          </nav>

          {/* Title & Key Meta */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={property.listing_type === "rent" ? "rent" : "sale"}>
                  {property.listing_type === "rent" ? "For Rent" : "For Sale"}
                </Badge>
                {property.price_grade_label && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                    {property.price_grade_label}
                  </span>
                )}
                <span className="text-xs text-neutral-500 capitalize">
                  {property.property_type}
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl lg:text-4xl">
                {property.title}
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-4 text-brand shrink-0"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {property.location}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Guide Price
              </p>
              <p className="font-display text-2xl sm:text-3xl font-bold text-ink text-brand">
                {priceFormatted}
              </p>
            </div>
          </div>

          {/* Photo Gallery Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:col-span-2 overflow-hidden rounded-2xl bg-neutral-100 shadow-xs">
              <Image
                src={mainImageUrl}
                alt={property.image_alt || property.title}
                fill
                priority
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="object-cover"
              />
            </div>
            {allImages.length > 1 ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                {allImages.slice(1, 3).map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-neutral-100 shadow-xs"
                  >
                    <Image
                      src={url}
                      alt={`${property.title} preview ${index + 2}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-semibold text-ink">Property Overview</h2>
                  <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                    Verified listing in {property.location}. Complete with detailed market pricing evaluation.
                  </p>
                </div>
                <div className="pt-4 border-t border-neutral-100 text-xs text-neutral-500">
                  ID: <span className="font-mono">{property.id.slice(0, 8)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {property.bedrooms !== null && (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-neutral-500">Bedrooms</span>
                <p className="mt-1 text-lg font-bold text-ink">{property.bedrooms}</p>
              </div>
            )}
            {property.bathrooms !== null && (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-neutral-500">Bathrooms</span>
                <p className="mt-1 text-lg font-bold text-ink">{property.bathrooms}</p>
              </div>
            )}
            {property.floor_area_sqft !== null && (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-neutral-500">Floor Area</span>
                <p className="mt-1 text-lg font-bold text-ink">
                  {property.floor_area_sqft.toLocaleString("en-US")} sq ft
                </p>
              </div>
            )}
            {property.land_size_perches !== null && (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-neutral-500">Land Size</span>
                <p className="mt-1 text-lg font-bold text-ink">
                  {property.land_size_perches} Perches
                </p>
              </div>
            )}
            {property.furnishing_status && (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-neutral-500">Furnishing</span>
                <p className="mt-1 text-base font-bold text-ink capitalize">
                  {property.furnishing_status.replace(/_/g, " ")}
                </p>
              </div>
            )}
            {property.parking_spaces !== null && (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-neutral-500">Parking</span>
                <p className="mt-1 text-lg font-bold text-ink">
                  {property.parking_spaces} {property.parking_spaces === 1 ? "Space" : "Spaces"}
                </p>
              </div>
            )}
          </div>

          {/* Description & Amenities */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 sm:p-8 shadow-xs">
                <h2 className="text-lg font-bold text-ink sm:text-xl">About this Property</h2>
                <div className="mt-4 text-sm sm:text-base leading-relaxed text-neutral-700 whitespace-pre-line">
                  {property.description}
                </div>
              </section>

              {amenitiesList.length > 0 && (
                <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 sm:p-8 shadow-xs">
                  <h2 className="text-lg font-bold text-ink sm:text-xl">Features & Amenities</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {amenitiesList.map((amenity) => (
                      <div
                        key={amenity}
                        className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-800 capitalize"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="size-3.5 text-brand shrink-0"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs space-y-4">
                <h3 className="font-semibold text-base text-ink">Location & Neighborhood</h3>
                <p className="text-sm text-neutral-600">
                  Situated in prime <span className="font-semibold text-ink">{property.location}</span>.
                </p>
                {property.road_access_ft && (
                  <p className="text-xs text-neutral-500">
                    Road Access: <span className="font-medium text-ink">{property.road_access_ft} ft wide</span>
                  </p>
                )}
                {property.build_year && (
                  <p className="text-xs text-neutral-500">
                    Year Built: <span className="font-medium text-ink">{property.build_year}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Interactive AI Advisor CTA */}
          <PropertyInquiryCta
            propertyId={property.id}
            title={property.title}
            location={property.location}
            price={priceFormatted}
          />
        </Container>
      </main>
      <Footer />
      <ChatDialog />
    </>
  );
}
