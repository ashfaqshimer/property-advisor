"use client";

import { useState } from "react";
import Image from "next/image";
import Container from "@/components/layout/Container";
import { Badge } from "@/components/ui/badge";
import { openChat } from "@/lib/chat-dialog";

type FeaturedItem = {
  id: string;
  title: string;
  location: string;
  badge: "For Sale" | "For Rent";
  badgeVariant: "sale" | "rent";
  specs: string[];
  price: string;
  imageUrl: string;
  imageAlt: string;
};

const FEATURED_ITEMS: FeaturedItem[] = [
  {
    id: "colombo-03-apartment",
    title: "Modern Apartment – Colombo 03",
    location: "Colombo 03",
    badge: "For Sale",
    badgeVariant: "sale",
    specs: ["3 Bed", "2 Bath", "1,800 sq ft"],
    price: "LKR 38,000,000",
    imageUrl: "/images/apartment_colombo03.jpg",
    imageAlt: "Modern luxury apartment living room with panoramic glass balcony",
  },
  {
    id: "nugegoda-luxury-house",
    title: "Luxury House – Nugegoda",
    location: "Nugegoda",
    badge: "For Sale",
    badgeVariant: "sale",
    specs: ["4 Bed", "3 Bath", "3,500 sq ft"],
    price: "LKR 65,000,000",
    imageUrl: "/images/house_nugegoda.jpg",
    imageAlt: "Contemporary architect-designed house with warm exterior lighting and garden",
  },
  {
    id: "rajagiriya-apartment",
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
    title: "Land – Galle",
    location: "Galle",
    badge: "For Sale",
    badgeVariant: "sale",
    specs: ["0.5 Acres"],
    price: "LKR 22,000,000",
    imageUrl: "/images/galle_land.jpg",
    imageAlt: "Pristine coastal headland and turquoise beach bay in Galle Sri Lanka",
  },
];

export default function FeaturedProperties() {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCardClick = (item: FeaturedItem) => {
    openChat(`Tell me more about ${item.title} in ${item.location}`);
  };

  return (
    <section
      id="featured-properties"
      aria-labelledby="featured-heading"
      className="scroll-mt-20 border-b border-neutral-200/80 bg-white py-16 sm:py-24"
    >
      <Container>
        {/* Header Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              FEATURED PROPERTIES
            </p>
            <h2
              id="featured-heading"
              className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl"
            >
              Handpicked for you
            </h2>
          </div>

          <button
            type="button"
            onClick={() => openChat("Show me all available properties in Colombo and Sri Lanka")}
            className="group inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-[#233c32]"
          >
            <span>View all properties</span>
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

        {/* 4-Card Responsive Grid */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_ITEMS.map((item) => {
            const isFav = !!favorites[item.id];
            return (
              <article
                key={item.id}
                onClick={() => handleCardClick(item)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg"
              >
                {/* Photo & Overlays */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                  <Image
                    src={item.imageUrl}
                    alt={item.imageAlt}
                    fill
                    unoptimized
                    loading="eager"
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Badge: For Sale / For Rent */}
                  <div className="absolute bottom-3 left-3">
                    <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                  </div>

                  {/* Heart Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(e, item.id)}
                    aria-label={`Save ${item.title}`}
                    className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-2xs transition-colors hover:bg-white"
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
                    {item.title}
                  </h3>

                  {/* Specs */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                    {item.specs.map((spec, i) => (
                      <span key={spec} className="inline-flex items-center">
                        {spec}
                        {i < item.specs.length - 1 && (
                          <span className="mx-1.5 text-neutral-300">•</span>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Price */}
                  <p className="mt-4 font-bold text-base text-ink">
                    {item.price}
                  </p>

                  {/* Location Pin */}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
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
      </Container>
    </section>
  );
}
