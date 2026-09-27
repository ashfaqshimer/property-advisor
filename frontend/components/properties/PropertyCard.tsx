import Image from "next/image";
import type { ReactNode } from "react";

import type { Property } from "@/lib/properties";

/**
 * Shared shell for the four decorative glyphs below. Every one is `aria-hidden`
 * — the adjacent text carries the meaning, so announcing them would only
 * duplicate it.
 */
function Icon({
  children,
  className = "size-3.5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} shrink-0`}
    >
      {children}
    </svg>
  );
}

const PinIcon = () => (
  <Icon className="size-3">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);

const BedIcon = () => (
  <Icon>
    <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
    <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
    <path d="M2 18h20" />
  </Icon>
);

const BathIcon = () => (
  <Icon>
    <path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 4 0M6 19l-1 2M18 19l1 2" />
  </Icon>
);

const AreaIcon = () => (
  <Icon>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
);

/**
 * "1 bed" but "2 beds". No current fixture has a count of 1 — this guards the
 * real listings that replace them, and is covered by its own test so the
 * behaviour cannot rot unnoticed in the meantime.
 */
function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-surface shadow-xs">
      {/*
        The wrapper carries the ratio so `fill` has a sized box to fill, and so
        the card holds its shape even if the remote photo never loads. The
        neutral background is what shows through in that case.
      */}
      <div className="relative aspect-4/3 sm:aspect-16/10 w-full bg-band overflow-hidden">
        {property.imageUrl ? (
          <Image
            src={property.imageUrl}
            alt={property.imageAlt}
            fill
            sizes="(min-width: 1024px) 720px, 100vw"
            className="object-cover transition-transform duration-700 hover:scale-105"
          />
        ) : (
          <div role="img" aria-label={property.imageAlt} className="size-full" />
        )}

        <p className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium text-ink shadow-xs backdrop-blur-sm">
          <PinIcon />
          {property.location}
        </p>

        <p className="absolute bottom-3 left-3 inline-flex items-center rounded-xl bg-ink/80 px-3 py-1 text-xs font-medium text-white shadow-xs backdrop-blur-sm sm:hidden">
          Price on request • Ask Amaya
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
            {property.title}
          </h3>
          <span className="hidden text-xs font-semibold tracking-wide text-brand uppercase sm:inline-block">
            Price on request • Ask Amaya
          </span>
        </div>

        <p className="mt-2.5 mb-5 text-sm leading-relaxed text-muted sm:text-base line-clamp-3">
          {property.description}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200/80 pt-4 text-xs font-medium text-muted sm:text-sm [&>span]:inline-flex [&>span]:items-center [&>span]:gap-2">
          {property.beds !== null && <span><BedIcon />{plural(property.beds, "bed")}</span>}
          {property.baths !== null && <span><BathIcon />{plural(property.baths, "bath")}</span>}
          {property.sqft !== null && <span><AreaIcon />{property.sqft.toLocaleString("en-US")} sqft</span>}
        </div>
      </div>
    </article>
  );
}
