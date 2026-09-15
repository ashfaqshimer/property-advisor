"use client";

import { useEffect, useState } from "react";

import PropertyCard from "@/components/properties/PropertyCard";
import { getFeaturedProperties } from "@/lib/api";
import { mapProperty } from "@/lib/properties";

export function PropertyGridSkeleton() {
  return (
    <section
      aria-labelledby="featured-properties-heading"
      className="flex scroll-mt-24 flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
        <h2 id="featured-properties-heading" className="sr-only">
          Featured properties
        </h2>
        <div className="h-10 w-64 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 max-w-md animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="aspect-4/3 animate-pulse rounded-2xl bg-neutral-200"
          />
        ))}
      </div>
    </section>
  );
}

function PropertyGridMessage({ children }: { children: string }) {
  return (
    <section
      id="featured-properties"
      aria-labelledby="featured-properties-heading"
      className="flex scroll-mt-24 flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        {/* Typed in sentence case and uppercased in CSS, so a screen reader
            reads a phrase rather than spelling out initialisms. */}
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Handpicked for you
        </p>

        <h2
          id="featured-properties-heading"
          className="font-display text-3xl leading-tight text-ink sm:text-4xl"
        >
          Featured properties
        </h2>

        <p className="max-w-md text-sm leading-relaxed text-muted">
          A curated selection across Colombo and the wider island — from city
          apartments to coastal retreats.
        </p>
      </div>
      <p className="border border-dashed border-neutral-300 p-6 text-sm text-muted">
        {children}
      </p>
    </section>
  );
}

export function PropertyGridContent({
  properties,
}: {
  properties: ReturnType<typeof mapProperty>[];
}) {
  return (
    <section
      id="featured-properties"
      aria-labelledby="featured-properties-heading"
      className="flex scroll-mt-24 flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Handpicked for you
        </p>
        <h2
          id="featured-properties-heading"
          className="font-display text-3xl leading-tight text-ink sm:text-4xl"
        >
          Featured properties
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          A curated selection across Colombo and the wider island — from city
          apartments to coastal retreats.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}

export default function PropertyGrid() {
  const [properties, setProperties] = useState<ReturnType<typeof mapProperty>[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    getFeaturedProperties()
      .then((records) => setProperties(records.map(mapProperty).slice(0, 6)))
      .catch(() => setHasError(true));
  }, []);

  if (hasError) {
    return <PropertyGridMessage>Featured properties are temporarily unavailable.</PropertyGridMessage>;
  }

  if (properties === null) {
    return <PropertyGridSkeleton />;
  }

  if (properties.length === 0) {
    return <PropertyGridMessage>No featured properties are available right now.</PropertyGridMessage>;
  }

  return <PropertyGridContent properties={properties} />;
}
