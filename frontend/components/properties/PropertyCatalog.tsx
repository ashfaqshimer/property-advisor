"use client";

import { useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");
  const [listingType, setListingType] = useState<"all" | "sale" | "rent">("all");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = useMemo(() => {
    return initialProperties.filter((item) => {
      if (listingType !== "all" && item.listing_type !== listingType) {
        return false;
      }
      if (
        propertyType !== "all" &&
        item.property_type?.toLowerCase() !== propertyType.toLowerCase()
      ) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesLocation = item.location?.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesLocation && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [initialProperties, listingType, propertyType, search]);

  const propertyTypes = useMemo(() => {
    const types = new Set<string>();
    initialProperties.forEach((p) => {
      if (p.property_type) types.add(p.property_type);
    });
    return Array.from(types);
  }, [initialProperties]);

  return (
    <div className="space-y-8">
      {/* Search and Filters Bar */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-6 shadow-xs space-y-4">
        {/* Search input */}
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by neighborhood, keyword, or features (e.g. Colombo 03, pool)..."
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-neutral-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-ink cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100">
          {/* Sale vs Rent */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => setListingType("all")}
              className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                listingType === "all"
                  ? "bg-white text-ink shadow-2xs font-semibold"
                  : "text-neutral-600 hover:text-ink"
              }`}
            >
              All Listings
            </button>
            <button
              type="button"
              onClick={() => setListingType("sale")}
              className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                listingType === "sale"
                  ? "bg-white text-ink shadow-2xs font-semibold"
                  : "text-neutral-600 hover:text-ink"
              }`}
            >
              For Sale
            </button>
            <button
              type="button"
              onClick={() => setListingType("rent")}
              className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                listingType === "rent"
                  ? "bg-white text-ink shadow-2xs font-semibold"
                  : "text-neutral-600 hover:text-ink"
              }`}
            >
              For Rent
            </button>
          </div>

          {/* Property Types */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setPropertyType("all")}
              className={`rounded-lg px-3 py-1.5 border transition-all cursor-pointer ${
                propertyType === "all"
                  ? "border-brand bg-brand/5 text-brand font-semibold"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
              }`}
            >
              All Types
            </button>
            {propertyTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPropertyType(type)}
                className={`rounded-lg px-3 py-1.5 border capitalize transition-all cursor-pointer ${
                  propertyType === type
                    ? "border-brand bg-brand/5 text-brand font-semibold"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          Showing <span className="font-semibold text-ink">{filtered.length}</span> properties
        </span>
        <button
          type="button"
          onClick={() =>
            openChat(
              search
                ? `I am looking for properties matching "${search}"`
                : "Help me find properties based on my specific criteria"
            )
          }
          className="text-brand hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
        >
          <span>Ask Amaya to refine search</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Property Cards Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
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
      ) : (
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-ink sm:text-lg">
            No properties found matching your filters
          </h3>
          <p className="mt-1 text-sm text-neutral-600 max-w-md mx-auto">
            Try adjusting your search criteria or ask Amaya to help you find unlisted properties.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setListingType("all");
                setPropertyType("all");
              }}
              className="rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
