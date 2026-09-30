"use client";

import Image from "next/image";
import Container from "@/components/layout/Container";
import { openChat } from "@/lib/chat-dialog";

const LOCATIONS = [
  "Colombo",
  "Dehiwala",
  "Rajagiriya",
  "Nugegoda",
  "Kandy",
  "Galle",
  "Negombo",
  "Battaramulla",
  "Mount Lavinia",
];

export default function IslandWideReach() {
  const handleLocationClick = (loc: string) => {
    openChat(`Show me properties in ${loc}`);
  };

  return (
    <section
      id="locations"
      aria-labelledby="locations-heading"
      className="scroll-mt-20 border-b border-neutral-200/80 bg-[#fbfbfa] py-16 sm:py-24"
    >
      <Container>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Scenic Sri Lanka Photography */}
          <div className="relative aspect-[4/3] min-h-[280px] sm:min-h-[340px] w-full overflow-hidden rounded-2xl border border-neutral-200/80 shadow-md lg:col-span-5">
            <Image
              src="/images/sri_lanka_scenic.jpg"
              alt="Lush green mountain landscape in Sri Lanka"
              fill
              unoptimized
              loading="eager"
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <p className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3.5 py-1 text-xs font-medium text-neutral-800 backdrop-blur-md shadow-xs">
              Island-wide coverage 🌴
            </p>
          </div>

          {/* Right Column: Copy, Button, Map + City List */}
          <div className="flex flex-col lg:col-span-7">
            <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              MADE FOR SRI LANKA
            </p>

            <h2
              id="locations-heading"
              className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl"
            >
              From Colombo to Galle, and everywhere in between.
            </h2>

            <p className="mt-5 text-base leading-relaxed text-neutral-600 sm:text-lg">
              Whether it&apos;s a city apartment, a family home, or a piece of
              land, we help you find what you&apos;re looking for — anywhere in
              Sri Lanka.
            </p>

            <div className="mt-7">
              <button
                type="button"
                onClick={() => openChat("Explore island-wide locations and neighborhoods")}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-on-brand shadow-xs transition-all hover:bg-[#233c32]"
              >
                <span>Explore locations</span>
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

            {/* Map Outline Graphic & City List Grid */}
            <div className="mt-10 grid grid-cols-1 items-center gap-8 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs sm:grid-cols-12 sm:gap-6">
              {/* Sri Lanka Stylized Silhouette SVG with glowing location dots */}
              <div className="flex justify-center sm:col-span-5">
                <svg
                  viewBox="0 0 160 240"
                  className="h-52 w-auto drop-shadow-sm"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Map of Sri Lanka with covered regions"
                >
                  {/* Island Coastline Silhouette */}
                  <path
                    d="M72 12 C82 14, 94 28, 98 42 C104 56, 116 78, 122 102 C128 126, 126 150, 118 174 C110 196, 92 216, 76 226 C66 230, 58 226, 52 216 C42 198, 40 180, 42 160 C40 144, 46 128, 48 112 C44 94, 52 74, 58 52 C62 34, 64 18, 72 12 Z"
                    className="fill-neutral-50 stroke-neutral-300 stroke-[1.5]"
                  />
                  {/* Soft topographic accent contour */}
                  <path
                    d="M70 70 C80 82, 92 100, 90 125 C88 150, 80 170, 70 185"
                    stroke="#e2e8f0"
                    strokeWidth="1.2"
                    strokeDasharray="2 3"
                  />

                  {/* Colombo Dot & Wave */}
                  <circle cx="50" cy="148" r="4.5" className="fill-[#2c4a3e]" />
                  <circle cx="50" cy="148" r="9" className="animate-ping fill-[#2c4a3e]/30" />

                  {/* Negombo */}
                  <circle cx="48" cy="130" r="3.5" className="fill-[#2c4a3e]" />

                  {/* Kandy */}
                  <circle cx="76" cy="136" r="3.5" className="fill-[#2c4a3e]" />

                  {/* Galle */}
                  <circle cx="58" cy="208" r="3.5" className="fill-[#2c4a3e]" />

                  {/* Matara */}
                  <circle cx="78" cy="216" r="3" className="fill-[#2c4a3e]" />

                  {/* Jaffna / North */}
                  <circle cx="74" cy="24" r="3" className="fill-[#2c4a3e]" />

                  {/* Trincomalee */}
                  <circle cx="106" cy="88" r="3" className="fill-[#2c4a3e]" />

                  {/* Batticaloa */}
                  <circle cx="118" cy="132" r="3" className="fill-[#2c4a3e]" />
                </svg>
              </div>

              {/* City List with Bullet Points */}
              <div className="sm:col-span-7">
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-1">
                  {LOCATIONS.map((loc) => (
                    <li key={loc}>
                      <button
                        type="button"
                        onClick={() => handleLocationClick(loc)}
                        className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-700 transition-colors hover:text-brand"
                      >
                        <span className="size-1.5 rounded-full bg-brand" />
                        <span>{loc}</span>
                      </button>
                    </li>
                  ))}
                  <li className="text-xs italic text-neutral-400">
                    ... and more
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
