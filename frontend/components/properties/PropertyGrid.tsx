"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import PropertyCard from "@/components/properties/PropertyCard";
import ServicesAndMarketGuide from "@/components/properties/ServicesAndMarketGuide";
import { getFeaturedProperties } from "@/lib/api";
import { mapProperty } from "@/lib/properties";

const SLIDE_DURATION_MS = 5500;

const ChevronLeftIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const PauseIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3.5 shrink-0"
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const PlayIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="size-3.5 shrink-0"
  >
    <path d="M8 5.14v14c0 .86.94 1.39 1.68.94l11-7c.72-.45.72-1.48 0-1.93l-11-7c-.74-.45-1.68.08-1.68.99Z" />
  </svg>
);

const SparkleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3.5 shrink-0"
  >
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

function ConciergeCard() {
  const handleAskAmaya = () => {
    const chatInput = document.querySelector<HTMLTextAreaElement>(
      "#chat textarea",
    );
    if (chatInput) {
      chatInput.focus();
    }
  };

  return (
    <div className="flex h-full min-h-[440px] flex-col justify-between overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/10 via-surface to-brand/15 p-6 sm:p-8 shadow-xs">
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold tracking-wide text-brand uppercase">
            <SparkleIcon />
            Off-Market Concierge
          </span>
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75 duration-1000" />
            <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
          </span>
        </div>

        <div className="mt-8">
          <p className="font-display text-2xl sm:text-3xl font-bold leading-tight text-ink">
            Looking for something specific?
          </p>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted max-w-xl">
            These are just a few handpicked previews. Amaya has direct access to
            unlisted luxury apartments, sea-facing penthouses, and private
            villas across Colombo.
          </p>
        </div>

        <div className="mt-8 space-y-3 border-t border-brand/15 pt-5">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">
            Direct Concierge Inquiries:
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-neutral-200/90 bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-2xs">
              Colombo 3 & 7
            </span>
            <span className="rounded-lg border border-neutral-200/90 bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-2xs">
              Sea-View Penthouses
            </span>
            <span className="rounded-lg border border-neutral-200/90 bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-2xs">
              Havelock City
            </span>
            <span className="rounded-lg border border-neutral-200/90 bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-2xs">
              Private Villas
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-brand/15 pt-6">
        <a
          href="#chat"
          onClick={handleAskAmaya}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand shadow-sm"
        >
          <span>Ask Amaya to match</span>
          <ArrowRightIcon />
        </a>
      </div>
    </div>
  );
}

export function PropertyGridSkeleton() {
  return (
    <section
      aria-labelledby="featured-properties-heading"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
        <h2 id="featured-properties-heading" className="sr-only">
          Featured properties
        </h2>
        <div className="h-10 w-64 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 max-w-md animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="aspect-16/10 w-full animate-pulse rounded-2xl bg-neutral-200" />
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
        <h2
          id="featured-properties-heading"
          className="font-display text-3xl leading-tight text-ink sm:text-4xl"
        >
          Featured properties
        </h2>

        <p className="max-w-md text-sm leading-relaxed text-muted">
          A curated selection across Colombo and the wider island, from city
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const totalSlides = properties.length + 1; // 6 properties + 1 concierge card
  const isEndCap = currentIndex === totalSlides - 1;
  const isPaused = isHovered || isTouched || isManualPaused || isEndCap;

  // Auto-advance: slides automatically, pausing when hovered, touched, or on the End-Cap
  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
    }, SLIDE_DURATION_MS);

    return () => clearTimeout(timer);
  }, [currentIndex, isPaused, totalSlides]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  }, [totalSlides]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0));
  }, [totalSlides]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    setIsTouched(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsTouched(false);
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartXRef.current = null;
  };

  return (
    <section
      id="featured-properties"
      aria-labelledby="featured-properties-heading"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="featured-properties-heading"
            className="font-display text-3xl leading-tight text-ink sm:text-4xl"
          >
            Featured properties
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsManualPaused((prev) => !prev)}
              aria-label={isManualPaused ? "Resume auto-slide" : "Pause auto-slide"}
              className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-surface text-ink transition-colors hover:bg-neutral-100 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
            >
              {isManualPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous properties"
              className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-surface text-ink transition-colors hover:bg-neutral-100 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next properties"
              className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-surface text-ink transition-colors hover:bg-neutral-100 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-muted">
          A curated selection across Colombo and the wider island, from city
          apartments to coastal retreats.
        </p>
      </div>

      {/* Story-Style Segmented Progress Bar */}
      <div
        className="flex items-center gap-1.5"
        role="tablist"
        aria-label="Properties slides"
      >
        {Array.from({ length: totalSlides }, (_, i) => {
          const isCurrent = i === currentIndex;
          const isPassed = i < currentIndex;
          const isSlideEndCap = i === totalSlides - 1;

          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-label={
                isSlideEndCap
                  ? "Go to Off-Market Concierge"
                  : `Go to property ${i + 1}`
              }
              onClick={() => setCurrentIndex(i)}
              className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200/90 transition-all hover:h-2 cursor-pointer"
            >
              <div
                key={`${i}-${currentIndex}-${isPaused}`}
                className={`h-full rounded-full bg-brand transition-all ${
                  isPassed
                    ? "w-full"
                    : isCurrent
                      ? isEndCap
                        ? "w-full"
                        : "animate-progress-fill"
                      : "w-0"
                }`}
                style={
                  isCurrent && !isEndCap
                    ? { animationPlayState: isPaused ? "paused" : "running" }
                    : undefined
                }
              />
            </button>
          );
        })}
      </div>

      {/* Spotlight Carousel Viewport */}
      <div
        className="overflow-hidden rounded-2xl"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {properties.map((property) => (
            <div key={property.id} className="w-full shrink-0">
              <PropertyCard property={property} />
            </div>
          ))}
          <div className="w-full shrink-0">
            <ConciergeCard />
          </div>
        </div>
      </div>

      <p className="text-center text-[0.6875rem] text-muted sm:hidden">
        Swipe or tap segments to explore residences & off-market concierge
      </p>
    </section>
  );
}

export default function PropertyGrid() {
  const [properties, setProperties] = useState<
    ReturnType<typeof mapProperty>[] | null
  >(null);
  const [hasError, setHasError] = useState(false);
  const [preferredLayout, setPreferredLayout] = useState<"featured" | "services" | null>(null);

  useEffect(() => {
    // 1. Allow instant dev preview via ?layout=services / ?layout=featured (or ?view=...)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlLayout = params.get("layout") || params.get("view");
      if (urlLayout === "services" || urlLayout === "featured") {
        setPreferredLayout(urlLayout);
      }
    }

    // 2. Fetch featured properties
    getFeaturedProperties()
      .then((records) => setProperties(records.map(mapProperty).slice(0, 6)))
      .catch(() => setHasError(true));
  }, []);

  // If admin configured "services" (or URL param requested it), render the new layout directly
  if (preferredLayout === "services") {
    return <ServicesAndMarketGuide />;
  }

  if (properties === null) {
    return <PropertyGridSkeleton />;
  }

  if (hasError || properties.length === 0) {
    return <ServicesAndMarketGuide />;
  }

  return <PropertyGridContent properties={properties} />;
}

