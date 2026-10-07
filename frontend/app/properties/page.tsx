import type { Metadata } from "next";
import Link from "next/link";

import Container from "@/components/layout/Container";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ChatDialog from "@/components/chat/ChatDialog";
import PropertyCatalog from "@/components/properties/PropertyCatalog";
import { getFeaturedProperties, type PropertyApiRecord } from "@/lib/api";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Properties for Sale & Rent in Colombo & Across Sri Lanka | Property Advisor",
  description:
    "Browse verified residential apartments, houses, land, and commercial properties across Colombo, Rajagiriya, Kandy, Galle, and Sri Lanka. Verified pricing and 24/7 AI advisory with Amaya.",
  alternates: {
    canonical: "/properties",
  },
  openGraph: {
    title: "Properties for Sale & Rent in Colombo & Across Sri Lanka | Property Advisor",
    description:
      "Explore prime real estate listings across Sri Lanka. Filter by location, price, and property type.",
    url: "/properties",
    type: "website",
    images: [
      {
        url: "/images/hero_apartment.jpg",
        alt: "Properties in Colombo and across Sri Lanka",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Properties for Sale & Rent in Colombo & Sri Lanka",
    description: "Browse verified residential apartments, houses, and land across Sri Lanka.",
    images: ["/images/hero_apartment.jpg"],
  },
};

const FALLBACK_PROPERTIES: PropertyApiRecord[] = [
  {
    id: "colombo-03-apartment",
    title: "Modern Apartment – Colombo 03",
    description: "Stunning modern luxury apartment living room with panoramic glass balcony overlooking Colombo.",
    location: "Colombo 03",
    price: 38000000,
    currency: "LKR",
    listing_type: "sale",
    is_price_per_perch: false,
    is_featured: true,
    property_type: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    floor_area_sqft: 1800,
    land_size_perches: null,
    parking_spaces: 1,
    build_year: 2021,
    road_access_ft: 30,
    furnishing_status: "furnished",
    amenities: { pool: true, gym: true, security: true },
    image_urls: ["/images/apartment_colombo03.jpg"],
    image_alt: "Modern luxury apartment living room with panoramic glass balcony",
    status: "available",
    created_at: new Date().toISOString(),
    property_contact_id: null,
    property_contact: null,
  },
  {
    id: "nugegoda-luxury-house",
    title: "Luxury House – Nugegoda",
    description: "Contemporary architect-designed house with warm exterior lighting and garden in prime Nugegoda residential neighborhood.",
    location: "Nugegoda",
    price: 65000000,
    currency: "LKR",
    listing_type: "sale",
    is_price_per_perch: false,
    is_featured: true,
    property_type: "house",
    bedrooms: 4,
    bathrooms: 3,
    floor_area_sqft: 3500,
    land_size_perches: 12,
    parking_spaces: 2,
    build_year: 2020,
    road_access_ft: 20,
    furnishing_status: "unfurnished",
    amenities: { garden: true, parking: true },
    image_urls: ["/images/house_nugegoda.jpg"],
    image_alt: "Contemporary architect-designed house with warm exterior lighting and garden",
    status: "available",
    created_at: new Date().toISOString(),
    property_contact_id: null,
    property_contact: null,
  },
  {
    id: "rajagiriya-apartment",
    title: "Apartment – Rajagiriya",
    description: "Bright high-rise apartment interior with wide windows and modern furniture overlooking wetland parklands.",
    location: "Rajagiriya",
    price: 250000,
    currency: "LKR",
    listing_type: "rent",
    is_price_per_perch: false,
    is_featured: true,
    property_type: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    floor_area_sqft: 1200,
    land_size_perches: null,
    parking_spaces: 1,
    build_year: 2022,
    road_access_ft: 40,
    furnishing_status: "fully_furnished",
    amenities: { pool: true, gym: true, elevator: true },
    image_urls: ["/images/apartment_rajagiriya.jpg"],
    image_alt: "Bright high-rise apartment interior with wide windows and modern furniture",
    status: "available",
    created_at: new Date().toISOString(),
    property_contact_id: null,
    property_contact: null,
  },
  {
    id: "galle-land",
    title: "Land – Galle",
    description: "Pristine coastal headland and turquoise beach bay parcel ideal for boutique villa or hospitality development.",
    location: "Galle",
    price: 22000000,
    currency: "LKR",
    listing_type: "sale",
    is_price_per_perch: false,
    is_featured: true,
    property_type: "land",
    bedrooms: null,
    bathrooms: null,
    floor_area_sqft: null,
    land_size_perches: 20,
    parking_spaces: null,
    build_year: null,
    road_access_ft: 20,
    furnishing_status: null,
    amenities: { beach_access: true },
    image_urls: ["/images/galle_land.jpg"],
    image_alt: "Pristine coastal headland and turquoise beach bay in Galle Sri Lanka",
    status: "available",
    created_at: new Date().toISOString(),
    property_contact_id: null,
    property_contact: null,
  },
];

export default async function PropertiesIndexPage() {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  let properties: PropertyApiRecord[] = [];
  try {
    properties = await getFeaturedProperties(50);
  } catch {
    // Graceful fallback during isolated builds
  }

  if (properties.length === 0) {
    properties = FALLBACK_PROPERTIES;
  }

  // Schema.org CollectionPage & ItemList
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Properties for Sale & Rent in Colombo & Across Sri Lanka",
    description:
      "Curated real estate catalog for apartments, houses, land, and commercial properties across Sri Lanka.",
    url: `${siteUrl}/properties`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: properties.map((prop, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/properties/${prop.id}`,
        name: prop.title,
      })),
    },
  };

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
            <span className="text-neutral-800 font-medium">Properties</span>
          </nav>

          {/* Heading */}
          <header className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              ALL LISTINGS
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink">
              Properties for Sale &amp; Rent in Sri Lanka
            </h1>
            <p className="text-base text-neutral-600 max-w-2xl">
              Explore prime apartments, family residences, land plots, and commercial opportunities across Colombo and island-wide.
            </p>
          </header>

          {/* Catalog Filter & Grid */}
          <PropertyCatalog initialProperties={properties} />
        </Container>
      </main>
      <Footer />
      <ChatDialog />
    </>
  );
}
