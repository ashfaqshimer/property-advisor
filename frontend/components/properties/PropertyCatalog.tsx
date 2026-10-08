"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { openChat } from "@/lib/chat-dialog";
import type { PropertyApiRecord } from "@/lib/api";

export default function PropertyCatalog({
  initialProperties,
}: {
  initialProperties: PropertyApiRecord[];
}) {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8">
      {/* Property Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {initialProperties.map((item) => {
          const isFav = !!favorites[item.id];
          const priceFormatted = `${item.currency || "LKR"} ${item.price.toLocaleString("en-US")}${
            item.listing_type === "rent" ? " / month" : ""
          }`;
          const imageUrl =
            item.featured_image_url ||
            (item.image_urls && item.image_urls[0]) ||
            "/images/apartment_colombo03.jpg";

          const specs: string[] = [];
          if (item.bedrooms !== null) specs.push(`${item.bedrooms} Bed`);
          if (item.bathrooms !== null) specs.push(`${item.bathrooms} Bath`);
          if (item.floor_area_sqft !== null) specs.push(`${item.floor_area_sqft.toLocaleString()} sqft`);
          if (item.land_size_perches !== null) specs.push(`${item.land_size_perches} Perch`);

          return (
            <article
              key={item.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                <Link
                  href={`/properties/${item.id}`}
                  className="block size-full"
                  aria-label={`View ${item.title}`}
                >
                  <Image
                    src={imageUrl}
                    alt={item.image_alt || item.title}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </Link>

                <div className="absolute bottom-3 left-3 pointer-events-none">
                  <Badge variant={item.listing_type === "rent" ? "rent" : "sale"}>
                    {item.listing_type === "rent" ? "For Rent" : "For Sale"}
                  </Badge>
                </div>

                <button
                  type="button"
                  onClick={(e) => toggleFavorite(e, item.id)}
                  aria-label={`Save ${item.title}`}
                  className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-2xs transition-colors hover:bg-white cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill={isFav ? "#e11d48" : "none"}
                    stroke={isFav ? "#e11d48" : "currentColor"}
                    strokeWidth="1.8"
                    className="size-4 text-neutral-700 transition-transform active:scale-125"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-semibold text-base text-ink line-clamp-1 group-hover:text-brand transition-colors">
                  <Link href={`/properties/${item.id}`} className="hover:underline">
                    {item.title}
                  </Link>
                </h2>

                {/* Specs */}
                {specs.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                    {specs.map((spec, i) => (
                      <span key={spec} className="inline-flex items-center">
                        {spec}
                        {i < specs.length - 1 && <span className="mx-1.5 text-neutral-300">•</span>}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-4 font-bold text-base text-ink text-brand">
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

      {/* Advisory Banner */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">
            Looking for something specific?
          </h3>
          <p className="mt-1 text-sm text-neutral-600 max-w-xl">
            Our AI advisor Amaya has access to off-market properties and real-time market data across Colombo and Sri Lanka.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openChat("I am looking for property options based on my specific criteria")}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#233c32] cursor-pointer shrink-0"
        >
          <span>Consult with Amaya</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
