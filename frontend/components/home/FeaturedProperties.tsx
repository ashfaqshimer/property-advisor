"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/layout/Container";
import { Badge } from "@/components/ui/badge";
import { openChat } from "@/lib/chat-dialog";
import {
  getFeaturedProperties,
  getInventorySummary,
  getSiteConfiguration,
  type PropertyApiRecord,
} from "@/lib/api";

function formatInventoryCount(count: number | null): string {
  if (!count || count < 100) return "1,500+";
  if (count >= 1000) {
    const rounded = Math.floor(count / 100) * 100;
    return `${rounded.toLocaleString()}+`;
  }
  const rounded = Math.floor(count / 10) * 10;
  return `${rounded}+`;
}

export type FeaturedItem = {
  id: string;
  propertyCode?: string;
  title: string;
  location: string;
  badge: "For Sale" | "For Rent";
  badgeVariant: "sale" | "rent";
  specs: string[];
  price: string;
  imageUrl: string;
  imageAlt: string;
};

const FALLBACK_FEATURED_ITEMS: FeaturedItem[] = [
  {
    id: "colombo-03-apartment",
    propertyCode: "PA-1001",
    title: "Modern Apartment – Colombo 03",
    location: "Colombo 03",
    badge: "For Sale",
    badgeVariant: "sale",
    specs: ["3 Bed", "2 Bath", "1,800 sq ft"],
    price: "LKR 38 Mn",
    imageUrl: "/images/apartment_colombo03.jpg",
    imageAlt: "Modern luxury apartment living room with panoramic glass balcony",
  },
  {
    id: "nugegoda-luxury-house",
    propertyCode: "PA-1002",
    title: "Luxury House – Nugegoda",
    location: "Nugegoda",
    badge: "For Sale",
    badgeVariant: "sale",
    specs: ["4 Bed", "3 Bath", "3,500 sq ft"],
    price: "LKR 65 Mn",
    imageUrl: "/images/house_nugegoda.jpg",
    imageAlt: "Contemporary architect-designed house with warm exterior lighting and garden",
  },
  {
    id: "rajagiriya-apartment",
    propertyCode: "PA-1003",
    title: "Apartment – Rajagiriya",
    location: "Rajagiriya",
    badge: "For Rent",
    badgeVariant: "rent",
    specs: ["2 Bed", "2 Bath", "1,200 sq ft"],
    price: "LKR 250,000 / month",
    imageUrl: "/images/apartment_rajagiriya.jpg",
    imageAlt: "Bright high-rise apartment interior with wide windows and modern furniture",
  },
  {
    id: "galle-land",
    propertyCode: "PA-1004",
    title: "Land – Galle",
    location: "Galle",
    badge: "For Sale",
    badgeVariant: "sale",
    specs: ["0.5 Acres"],
    price: "LKR 22 Mn",
    imageUrl: "/images/galle_land.jpg",
    imageAlt: "Pristine coastal headland and turquoise beach bay in Galle Sri Lanka",
  },
];

const CONCIERGE_PROMPTS = [
  {
    tag: "Off-Market Discovery",
    headline: "Looking for unlisted properties?",
    prompt: "I am looking for unlisted off-market houses or sea-view penthouses in Colombo. What do you have available?",
    buttonText: "Ask About Off-Market",
  },
  {
    tag: "Colombo 3 & 7",
    headline: "Prime Colombo Penthouses",
    prompt: "Show me available luxury apartments and penthouses in Colombo 3, 7, or Havelock City under LKR 75M.",
    buttonText: "Find Colombo 3 & 7",
  },
  {
    tag: "Price & Valuation",
    headline: "Wondering what's negotiable?",
    prompt: "Can you advise me on current square-foot prices and negotiable rates across Colombo suburbs?",
    buttonText: "Check Market Prices",
  },
  {
    tag: "Villas & Plots",
    headline: "Private Villas & Beach Plots",
    prompt: "Are there any architect-designed houses with pools or beach land plots in Galle or Talpe?",
    buttonText: "Explore Villas & Plots",
  },
];

const CONCIERGE_CHIPS = [
  {
    label: "Colombo 3 & 7",
    prompt: "What are the best available properties in Colombo 3 and Colombo 7 right now?",
  },
  {
    label: "Sea Views",
    prompt: "Show me apartments and penthouses with ocean or port city views in Colombo.",
  },
  {
    label: "Off-Market",
    prompt: "Amaya, do you have any unlisted or off-market properties for buyers?",
  },
];

function formatSpecs(record: PropertyApiRecord): string[] {
  const specs: string[] = [];
  if (record.bedrooms !== null && record.bedrooms !== undefined) {
    specs.push(`${record.bedrooms} Bed`);
  }
  if (record.bathrooms !== null && record.bathrooms !== undefined) {
    specs.push(`${record.bathrooms} Bath`);
  }
  if (record.floor_area_sqft !== null && record.floor_area_sqft !== undefined) {
    specs.push(`${record.floor_area_sqft.toLocaleString("en-US")} sq ft`);
  }
  if (record.land_size_perches !== null && record.land_size_perches !== undefined) {
    specs.push(`${record.land_size_perches} Perches`);
  }
  if (specs.length === 0 && record.property_type) {
    specs.push(
      record.property_type.charAt(0).toUpperCase() +
        record.property_type.slice(1)
    );
  }
  return specs;
}

function formatPrice(record: PropertyApiRecord): string {
  if (record.price === null || record.price === undefined) {
    return "Price on request";
  }
  const currency = record.currency || "LKR";
  if (record.listing_type === "rent") {
    return `${currency} ${record.price.toLocaleString("en-US")} / month`;
  }
  if (record.price >= 1_000_000_000) {
    const val = record.price / 1_000_000_000;
    return `${currency} ${val.toLocaleString("en-US", { maximumFractionDigits: 2 })} Bn`;
  }
  if (record.price >= 1_000_000) {
    const val = record.price / 1_000_000;
    return `${currency} ${val.toLocaleString("en-US", { maximumFractionDigits: 2 })} Mn`;
  }
  return `${currency} ${record.price.toLocaleString("en-US")}`;
}

function mapRecordToFeaturedItem(record: PropertyApiRecord): FeaturedItem {
  return {
    id: record.id,
    propertyCode: record.property_code,
    title: record.title,
    location: record.location,
    badge: record.listing_type === "rent" ? "For Rent" : "For Sale",
    badgeVariant: record.listing_type === "rent" ? "rent" : "sale",
    specs: formatSpecs(record),
    price: formatPrice(record),
    imageUrl:
      record.featured_image_url ||
      (record.image_urls && record.image_urls.length > 0 && record.image_urls[0]) ||
      "/images/apartment_colombo03.jpg",
    imageAlt: record.image_alt || record.title,
  };
}

function getGridColsClass(count: number): string {
  switch (count) {
    case 1:
      return "grid-cols-1";
    case 2:
      return "grid-cols-1 sm:grid-cols-2";
    case 3:
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    case 5:
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
    case 6:
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";
    case 4:
    default:
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  }
}

export interface FeaturedPropertiesProps {
  initialInventoryCount?: number | null;
  initialVisibleCount?: number;
  initialCycleIntervalSeconds?: number;
  initialAutoCycle?: boolean;
}

export default function FeaturedProperties({
  initialInventoryCount = null,
  initialVisibleCount,
  initialCycleIntervalSeconds,
  initialAutoCycle,
}: FeaturedPropertiesProps = {}) {
  const [items, setItems] = useState<FeaturedItem[] | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [inventoryCount, setInventoryCount] = useState<number | null>(initialInventoryCount);
  const [visibleCount, setVisibleCount] = useState<number>(initialVisibleCount ?? 4);
  const [cycleIntervalMs, setCycleIntervalMs] = useState<number>(
    (initialCycleIntervalSeconds ?? 6) * 1000
  );
  const [autoCycle, setAutoCycle] = useState<boolean>(initialAutoCycle ?? true);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [isFading, setIsFading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Amaya Concierge dynamic prompt cycling
  const [conciergeIndex, setConciergeIndex] = useState<number>(0);
  const [conciergeFading, setConciergeFading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getFeaturedProperties(50),
      getSiteConfiguration().catch(() => null),
      getInventorySummary().catch(() => null),
    ])
      .then(([records, config, summary]) => {
        if (!isMounted) return;
        if (summary?.total_listings) {
          setInventoryCount(summary.total_listings);
        }
        if (config?.featured_settings) {
          setVisibleCount(config.featured_settings.visible_count || 4);
          setCycleIntervalMs((config.featured_settings.cycle_interval_seconds || 6) * 1000);
          setAutoCycle(config.featured_settings.auto_cycle ?? true);
        }
        if (records && records.length > 0) {
          setItems(records.map(mapRecordToFeaturedItem));
        } else {
          setItems(FALLBACK_FEATURED_ITEMS);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setItems(FALLBACK_FEATURED_ITEMS);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Concierge card dynamic prompt ticker (Concept B)
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setConciergeFading(true);
      setTimeout(() => {
        setConciergeIndex((prev) => (prev + 1) % CONCIERGE_PROMPTS.length);
        setConciergeFading(false);
      }, 250);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused]);

  // Concept B (3 + 1): Number of properties shown alongside 1 Amaya Concierge card
  const propertiesPerSlide = Math.max(1, visibleCount - 1);

  // Periodic cycling through properties (pauses on hover)
  useEffect(() => {
    if (!autoCycle || !items || items.length <= propertiesPerSlide || isPaused) {
      return;
    }

    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setStartIndex((prev) => (prev + propertiesPerSlide) % items.length);
        setIsFading(false);
      }, 300);
    }, cycleIntervalMs);

    return () => clearInterval(timer);
  }, [autoCycle, items, propertiesPerSlide, isPaused, cycleIntervalMs]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAskAmayaAboutProperty = (item: FeaturedItem) => {
    const ref = item.propertyCode ? `property ${item.propertyCode} ("${item.title}")` : `"${item.title}"`;
    openChat({
      prompt: `Hi Amaya, tell me more about ${ref} in ${item.location} (${item.price}). Is it still available?`,
    });
  };

  const navigatePrev = () => {
    if (!items || items.length <= propertiesPerSlide) return;
    setIsFading(true);
    setTimeout(() => {
      setStartIndex((prev) => (prev - propertiesPerSlide + items.length * propertiesPerSlide) % items.length);
      setIsFading(false);
    }, 300);
  };

  const navigateNext = () => {
    if (!items || items.length <= propertiesPerSlide) return;
    setIsFading(true);
    setTimeout(() => {
      setStartIndex((prev) => (prev + propertiesPerSlide) % items.length);
      setIsFading(false);
    }, 300);
  };

  const visibleItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (items.length <= propertiesPerSlide) return items;
    const result: FeaturedItem[] = [];
    for (let i = 0; i < propertiesPerSlide; i++) {
      result.push(items[(startIndex + i) % items.length]);
    }
    return result;
  }, [items, propertiesPerSlide, startIndex]);

  const totalPages = items && items.length > 0 ? Math.ceil(items.length / propertiesPerSlide) : 1;
  const currentPage = Math.floor(startIndex / propertiesPerSlide);
  const displayCount = formatInventoryCount(inventoryCount);
  const activeConciergePrompt = CONCIERGE_PROMPTS[conciergeIndex];

  return (
    <section
      id="featured-properties"
      aria-labelledby="featured-properties-heading"
      className="scroll-mt-20 border-b border-neutral-200/80 bg-white py-16 sm:py-24"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <Container>
        {/* Header Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
                TRENDING LISTINGS
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 shadow-2xs">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {displayCount} Properties &amp; Market Listings
              </span>
            </div>
            <h2
              id="featured-properties-heading"
              aria-label="Trending properties"
              className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl"
            >
              Trending properties across Colombo &amp; beyond
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
              Explore handpicked listings or ask Amaya, our AI property advisor, to find unlisted and off-market options matching your exact criteria.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {items && items.length > propertiesPerSlide && (
              <div className="flex items-center gap-1.5" aria-label="Carousel navigation">
                <button
                  type="button"
                  onClick={navigatePrev}
                  aria-label="Previous featured properties"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-ink active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={navigateNext}
                  aria-label="Next featured properties"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-ink active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                openChat({
                  initialMessage:
                    "Which part of Sri Lanka are you looking for properties in? Tell me a city, suburb, or neighborhood (like Colombo, Kandy, or Galle), and I'll find what matches.",
                  suggestionChips: [
                    "Properties in Colombo",
                    "Properties in Kandy",
                    "Properties in Galle",
                    "Greater Colombo / Suburbs",
                  ],
                })
              }
              className="group inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-[#233c32]"
            >
              <span>Search all {displayCount} listings</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cards Grid: Concept B (3 Properties + 1 Dynamic Amaya Concierge Card) */}
        {items === null ? (
          <div
            data-testid="featured-properties-skeleton"
            className={`mt-10 grid gap-6 ${getGridColsClass(visibleCount)}`}
          >
            {Array.from({ length: Math.min(propertiesPerSlide, 3) }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs animate-pulse"
              >
                <div className="aspect-[4/3] w-full bg-neutral-200" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="h-4 w-3/4 rounded bg-neutral-200" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-neutral-100" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-neutral-100" />
                  <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between">
                    <div className="h-5 w-2/5 rounded bg-neutral-200" />
                    <div className="h-7 w-20 rounded-xl bg-neutral-200" />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs animate-pulse">
              <div className="aspect-[4/3] w-full bg-emerald-950/10 flex items-center justify-center">
                <div className="size-16 rounded-full bg-neutral-200" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="h-4 w-3/4 rounded bg-neutral-200" />
                <div className="mt-2 h-3 w-1/3 rounded bg-neutral-100" />
                <div className="mt-3 h-16 w-full rounded-xl bg-neutral-100" />
                <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between">
                  <div className="h-6 w-24 rounded-lg bg-neutral-100" />
                  <div className="h-7 w-20 rounded-xl bg-neutral-200" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`mt-10 grid gap-6 ${getGridColsClass(
              visibleCount
            )} transition-opacity duration-300 ease-in-out ${
              isFading ? "opacity-0" : "opacity-100"
            }`}
          >
            {/* Property Cards (Concept A: Contextual "Ask Amaya" CTA) */}
            {visibleItems.map((item) => {
              const isFav = !!favorites[item.id];
              return (
                <article
                  key={item.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg"
                >
                  {/* Photo & Overlays */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                    <Link
                      href={`/properties/${item.id}`}
                      className="block size-full"
                      aria-label={`View details for ${item.title}`}
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        fill
                        unoptimized
                        loading="eager"
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </Link>

                    {/* Top-left: Property Ref Code */}
                    {item.propertyCode && (
                      <div className="absolute top-3 left-3 z-10 pointer-events-none">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono font-medium text-white shadow-2xs">
                          <span className="text-[9px] uppercase tracking-wider text-neutral-300 font-sans">Ref</span>
                          <span>{item.propertyCode}</span>
                        </span>
                      </div>
                    )}

                    {/* Badge: For Sale / For Rent */}
                    <div className="absolute bottom-3 left-3 pointer-events-none">
                      <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                    </div>

                    {/* Heart Favorite Button */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(e, item.id)}
                      aria-label={`Save ${item.title}`}
                      className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-2xs transition-colors hover:bg-white"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill={isFav ? "#e11d48" : "none"}
                        stroke={isFav ? "#e11d48" : "currentColor"}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-4 text-neutral-700 transition-transform active:scale-125"
                        aria-hidden="true"
                      >
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </svg>
                    </button>
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-semibold text-base text-ink line-clamp-1 group-hover:text-brand transition-colors">
                      <Link href={`/properties/${item.id}`} className="hover:underline">
                        {item.title}
                      </Link>
                    </h3>

                    {/* Location Pin */}
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-3.5 shrink-0 text-neutral-400"
                        aria-hidden="true"
                      >
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="truncate">{item.location}</span>
                    </div>

                    {/* Specs */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                      {item.specs.map((spec, i) => (
                        <span key={spec} className="inline-flex items-center">
                          {spec}
                          {i < item.specs.length - 1 && (
                            <span className="mx-1.5 text-neutral-300">•</span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Footer: Price */}
                    <div className="mt-auto pt-4 border-t border-neutral-100">
                      <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Guide Price
                      </span>
                      <p className="font-bold text-base sm:text-lg text-ink">
                        {item.price}
                      </p>
                    </div>
                  </div>

                  {/* Full-width "Ask Amaya" Action Bar */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAskAmayaAboutProperty(item);
                    }}
                    aria-label={`Ask Amaya about ${item.title}`}
                    className="flex w-full items-center justify-center gap-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white cursor-pointer group/cta"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5 transition-transform group-hover/cta:scale-110"
                      aria-hidden="true"
                    >
                      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1-1.3-1.3Z" />
                    </svg>
                    <span>Ask Amaya about this property</span>
                  </button>
                </article>
              );
            })}

            {/* Concept B: The 4th Slot - Elevated Amaya AI Concierge Card */}
            <article
              aria-label="Amaya AI Property Concierge"
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
            >
              {/* Top 4:3 AI Stage (Matches property photo aspect ratio & grid line) */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#16382b] via-[#214d3b] to-[#0f241a] flex flex-col justify-between p-4">
                {/* Atmospheric Glow Accents */}
                <div className="absolute -top-10 -right-10 size-36 rounded-full bg-emerald-400/20 blur-xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 size-36 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />

                {/* Top Row: AI Badges */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs border border-white/20">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3 text-emerald-300"
                      aria-hidden="true"
                    >
                      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                    </svg>
                    <span>AI Concierge</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/70 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-emerald-300 border border-emerald-400/30">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online Now</span>
                  </span>
                </div>

                {/* Center Visual: Amaya Avatar + Soundwave Listener */}
                <div className="relative z-10 flex flex-col items-center justify-center my-auto">
                  <div className="relative size-16 sm:size-18 overflow-hidden rounded-full ring-4 ring-white/20 shadow-xl transition-transform duration-500 group-hover:scale-105">
                    <Image
                      src="/images/amaya_avatar.png"
                      alt="Amaya AI Advisor"
                      width={72}
                      height={72}
                      className="size-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2 ring-[#16382b]" />
                  </div>

                  {/* Active Audio Waveform Indicator */}
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/35 backdrop-blur-md px-2.5 py-0.5 border border-white/10 shadow-xs">
                    <span className="h-2 w-0.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="h-3.5 w-0.5 rounded-full bg-emerald-300 animate-[pulse_1.2s_ease-in-out_infinite_150ms]" />
                    <span className="h-2.5 w-0.5 rounded-full bg-emerald-400 animate-[pulse_0.9s_ease-in-out_infinite_300ms]" />
                    <span className="h-4 w-0.5 rounded-full bg-emerald-300 animate-[pulse_1.1s_ease-in-out_infinite_450ms]" />
                    <span className="h-2 w-0.5 rounded-full bg-emerald-400 animate-[pulse_0.8s_ease-in-out_infinite_200ms]" />
                    <span className="ml-1 text-[10px] font-medium text-emerald-100">Live Assistant</span>
                  </div>
                </div>

                {/* Bottom Overlay: Database Scope Pill */}
                <div className="relative z-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 px-3 py-1 text-center shadow-xs">
                  <p className="text-[11px] font-medium text-emerald-100 truncate">
                    Access to {displayCount} Verified &amp; Off-Market Listings
                  </p>
                </div>
              </div>

              {/* Bottom Content Body (Matches details padding & alignment of property cards) */}
              <div className="flex flex-1 flex-col p-5 bg-white">
                <h3 className="font-semibold text-base text-ink line-clamp-1 group-hover:text-brand transition-colors">
                  Looking for something specific?
                </h3>

                {/* Subtitle / Coverage Pin */}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="truncate">Islandwide • Colombo 3, 7, Suburbs &amp; Beyond</span>
                </div>

                {/* Interactive Speech Bubble with Rotating Prompt Ticker */}
                <div
                  onClick={() => openChat({ prompt: activeConciergePrompt.prompt })}
                  className="mt-2.5 flex flex-1 flex-col justify-between rounded-xl border border-brand/15 bg-gradient-to-br from-brand/5 to-emerald-50/40 p-3 cursor-pointer transition-all hover:border-brand/35 hover:bg-brand/10 hover:shadow-2xs group/bubble min-h-[84px]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand uppercase tracking-wider">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-2.5 text-brand"
                        aria-hidden="true"
                      >
                        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                      </svg>
                      {activeConciergePrompt.tag}
                    </span>

                    {/* Progress / Selector Dots */}
                    <div className="flex items-center gap-1" aria-label="Concierge prompt selector">
                      {CONCIERGE_PROMPTS.map((prompt, idx) => (
                        <button
                          key={prompt.tag}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConciergeFading(true);
                            setTimeout(() => {
                              setConciergeIndex(idx);
                              setConciergeFading(false);
                            }, 150);
                          }}
                          aria-label={`Switch to prompt: ${prompt.tag}`}
                          className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                            conciergeIndex === idx
                              ? "w-4 bg-brand"
                              : "w-1.5 bg-neutral-300 hover:bg-neutral-400"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className={`mt-1.5 transition-opacity duration-250 ease-in-out ${
                      conciergeFading ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <p className="text-xs text-neutral-700 leading-relaxed italic line-clamp-2">
                      &ldquo;{activeConciergePrompt.prompt}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Footer: Quick Chips + Action Button */}
                <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                    {CONCIERGE_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => openChat({ prompt: chip.prompt })}
                        className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-medium text-neutral-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand cursor-pointer truncate"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => openChat({ prompt: activeConciergePrompt.prompt })}
                    aria-label="Ask Amaya to match properties"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-[#233c32] hover:shadow-xs active:scale-95 shrink-0"
                  >
                    <span>Ask Amaya</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          </div>
        )}

        {/* Page / Indicator Dots for Multi-Page Browsing */}
        {items && items.length > propertiesPerSlide && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, pageIdx) => {
              const pageStartIdx = pageIdx * propertiesPerSlide;
              const isActive = currentPage === pageIdx;
              return (
                <button
                  key={pageIdx}
                  type="button"
                  onClick={() => {
                    if (isActive) return;
                    setIsFading(true);
                    setTimeout(() => {
                      setStartIndex(pageStartIdx);
                      setIsFading(false);
                    }, 300);
                  }}
                  aria-label={`Go to page ${pageIdx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive ? "w-6 bg-brand" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                  }`}
                />
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}
