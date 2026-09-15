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
    <article className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-surface">
      {/*
        The wrapper carries the ratio so `fill` has a sized box to fill, and so
        the card holds its shape even if the remote photo never loads. The
        neutral background is what shows through in that case.
      */}
      <div className="relative aspect-4/3 w-full bg-band">
        {property.imageUrl ? (
          <Image
            src={property.imageUrl}
            alt={property.imageAlt}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div role="img" aria-label={property.imageAlt} className="size-full" />
        )}

        <p className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-[0.6875rem] font-medium text-ink backdrop-blur-sm">
          <PinIcon />
          {property.location}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/*
          `items-baseline` aligns the price with the title's first line, so a
          title that wraps to two lines pushes only itself down. `shrink-0` plus
          `whitespace-nowrap` stops the narrow `lg` column from breaking
          "LKR 185M" across lines.
        */}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-base leading-snug text-ink">
            {property.title}
          </h3>
        </div>

        {/* `mb-4` rather than a margin on the divider: `mt-auto` below collapses
            to zero on the tallest card in a row, which would leave that one card
            with its rule jammed against the text. */}
        <p className="mt-2 mb-4 text-sm leading-relaxed text-muted">
          {property.description}
        </p>

        {/*
          `mt-auto` pins the meta row to the bottom, so cards in a row keep
          their dividers aligned when descriptions differ in length.
        */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-200/80 pt-3 text-xs text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">
          {property.beds !== null && <span><BedIcon />{plural(property.beds, "bed")}</span>}
          {property.baths !== null && <span><BathIcon />{plural(property.baths, "bath")}</span>}
          {property.sqft !== null && <span><AreaIcon />{property.sqft.toLocaleString("en-US")} sqft</span>}
        </div>
      </div>
    </article>
  );
}
