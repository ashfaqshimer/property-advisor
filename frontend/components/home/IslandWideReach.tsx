"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

const REGION_PINS = [
  {
    id: "colombo",
    name: "Colombo",
    cx: 45.9,
    cy: 199.8,
    isHub: true,
    matchedCities: ["Colombo", "Dehiwala", "Rajagiriya", "Nugegoda", "Battaramulla", "Mount Lavinia"],
  },
  {
    id: "negombo",
    name: "Negombo",
    cx: 44.3,
    cy: 182.5,
    matchedCities: ["Negombo"],
  },
  {
    id: "kandy",
    name: "Kandy",
    cx: 93.0,
    cy: 177.5,
    matchedCities: ["Kandy"],
  },
  {
    id: "galle",
    name: "Galle",
    cx: 67.6,
    cy: 253.5,
    matchedCities: ["Galle"],
  },
  {
    id: "matara",
    name: "Matara",
    cx: 88.1,
    cy: 259.6,
    matchedCities: ["Matara"],
  },
  {
    id: "jaffna",
    name: "Jaffna",
    cx: 54.8,
    cy: 31.7,
    matchedCities: ["Jaffna"],
  },
  {
    id: "trincomalee",
    name: "Trincomalee",
    cx: 129.4,
    cy: 97.8,
    matchedCities: ["Trincomalee"],
  },
  {
    id: "batticaloa",
    name: "Batticaloa",
    cx: 157.4,
    cy: 151.7,
    matchedCities: ["Batticaloa"],
  },
];

export default function IslandWideReach() {
  const [activeCity, setActiveCity] = useState<string | null>(null);

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
              {/* Sri Lanka Stylized Silhouette SVG with gentle beacon & interactive pins */}
              <div className="flex justify-center sm:col-span-5">
                <svg
                  viewBox="0 0 200 280"
                  className="h-60 w-auto drop-shadow-sm select-none"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Map of Sri Lanka with covered regions"
                >
                  {/* Island Coastline & Surrounding Islands Silhouette */}
                  <path
                    d="M158.7,153.4 L158.3,153.9 L158.1,153.8 L157.9,153.5 L158.0,153.1 L158.4,152.2 L158.6,152.0 L158.8,152.2 L158.9,152.5 L158.9,152.8 L158.9,153.1Z M164.3,166.0 L164.0,166.0 L163.4,165.6 L163.0,165.3 L162.8,165.0 L163.2,160.5 L161.9,157.5 L160.6,155.8 L159.5,153.1 L159.4,152.8 L159.3,149.9 L159.5,150.1 L159.9,150.5 L160.2,151.0 L161.0,152.7 L161.3,153.6 L163.9,157.8 L164.2,158.4 L164.5,159.7 L164.7,160.4 L165.6,165.5Z M49.0,71.3 L47.9,73.2 L45.2,72.3 L36.3,67.6 L35.9,67.3 L35.7,67.0 L35.7,66.7 L35.9,66.5 L36.2,66.4 L37.6,66.1 L38.8,66.0 L39.5,66.1 L43.8,67.2 L44.4,67.5 L44.9,67.8 L48.3,70.4 L48.9,71.0Z M37.1,43.1 L36.3,43.2 L36.0,43.1 L34.0,42.1 L33.7,41.9 L33.5,41.7 L33.2,41.2 L33.1,40.8 L33.2,38.8 L33.3,38.5 L33.5,38.2 L33.9,38.3 L34.1,38.5 L34.8,39.5 L37.0,40.2 L37.2,40.4 L37.4,40.6 L37.7,42.0 L37.6,42.3 L37.3,42.8Z M52.8,34.6 L52.4,34.6 L48.7,34.6 L48.4,34.6 L48.1,34.4 L46.5,33.4 L45.2,31.4 L45.0,30.3 L44.9,29.0 L45.3,26.5 L45.5,26.2 L46.0,25.9 L46.3,25.7 L47.2,25.7 L47.5,28.5 L47.8,29.8 L48.1,30.8 L48.3,31.0 L50.3,32.4 L51.1,33.0 L52.6,33.6 L53.0,34.0 L53.0,34.4Z M71.1,24.8 L75.0,30.0 L75.4,30.4 L76.0,31.1 L78.8,34.0 L89.3,42.1 L90.1,42.7 L90.3,42.8 L91.5,43.4 L92.5,44.1 L93.3,44.6 L94.7,45.7 L95.2,46.1 L97.9,48.9 L101.0,52.0 L103.0,54.2 L103.2,54.4 L104.5,56.3 L105.8,58.4 L106.1,59.0 L111.1,69.9 L111.0,73.7 L110.7,73.8 L110.5,74.0 L109.9,75.2 L109.9,75.6 L110.0,75.9 L110.4,76.4 L110.7,76.5 L110.9,76.7 L111.3,76.7 L111.6,76.6 L112.7,76.0 L113.0,75.9 L113.3,75.3 L116.9,77.5 L125.3,88.1 L128.8,93.1 L129.3,93.8 L129.4,94.1 L130.6,99.8 L130.7,100.2 L130.6,100.5 L130.4,100.7 L130.0,100.9 L129.7,100.9 L129.3,100.8 L129.0,100.7 L129.2,99.5 L129.0,99.2 L128.9,98.9 L128.6,98.8 L128.2,98.7 L127.9,98.8 L124.4,101.2 L124.0,101.7 L123.1,102.8 L123.2,103.1 L123.6,103.5 L123.8,103.7 L128.6,105.4 L130.7,105.9 L131.4,106.0 L131.7,105.9 L132.2,105.6 L132.5,105.4 L133.0,104.6 L133.1,104.3 L133.1,103.9 L133.0,103.5 L132.8,103.3 L132.9,103.0 L134.7,101.9 L135.1,101.8 L135.4,101.9 L136.8,103.4 L137.2,103.9 L137.3,104.2 L138.9,110.2 L139.0,110.9 L141.0,121.4 L139.8,122.5 L139.5,122.3 L139.2,122.4 L139.1,124.7 L140.9,128.0 L141.1,128.3 L146.8,133.8 L152.6,144.6 L157.3,148.5 L158.0,149.1 L158.3,149.6 L158.7,150.5 L158.6,151.3 L157.1,152.2 L157.0,153.4 L158.3,155.3 L159.0,156.0 L159.8,156.1 L161.1,157.7 L162.2,160.3 L161.8,161.6 L161.3,164.1 L161.3,164.5 L161.9,166.9 L163.6,168.0 L164.6,168.2 L164.9,166.3 L165.2,166.2 L165.6,166.2 L165.8,166.5 L167.3,170.4 L168.3,173.7 L168.4,174.3 L168.7,176.1 L168.9,177.6 L168.8,185.0 L169.5,194.5 L169.4,195.3 L168.9,197.9 L166.9,205.7 L165.9,209.7 L164.3,213.8 L163.5,215.0 L163.0,215.4 L163.0,217.2 L163.0,217.7 L162.8,218.4 L162.6,219.0 L161.7,220.6 L158.4,225.9 L157.8,227.0 L156.5,228.6 L155.5,229.7 L152.4,232.0 L140.1,241.3 L135.0,244.6 L134.4,244.8 L118.6,250.2 L116.4,250.4 L114.7,250.8 L108.5,253.0 L104.8,254.3 L102.6,255.8 L101.8,256.5 L99.7,258.2 L97.0,259.3 L90.4,261.8 L90.1,261.8 L81.9,260.1 L72.0,257.4 L71.6,257.3 L69.2,256.3 L66.6,255.2 L65.6,254.6 L61.3,249.6 L59.4,246.5 L57.1,242.0 L55.7,236.8 L53.5,230.2 L52.5,224.5 L52.5,224.2 L51.4,221.4 L49.8,217.2 L48.2,213.3 L47.1,210.6 L45.9,208.1 L45.7,207.5 L45.3,205.4 L44.4,199.6 L44.4,199.2 L44.5,198.9 L45.1,197.8 L45.9,196.5 L45.9,195.7 L45.4,187.8 L44.0,183.2 L44.4,178.8 L44.2,177.1 L43.2,170.6 L43.1,169.8 L41.3,158.1 L41.7,157.8 L41.9,156.3 L42.0,154.7 L41.2,149.2 L39.3,141.0 L38.7,138.7 L38.5,138.1 L38.1,137.2 L37.7,136.3 L37.2,134.7 L37.0,134.1 L36.8,133.4 L36.5,131.7 L36.2,129.0 L35.9,122.1 L36.0,121.7 L36.6,120.3 L37.5,119.0 L39.1,117.5 L37.6,125.9 L37.6,126.3 L37.9,132.6 L37.9,132.9 L38.0,133.3 L38.1,133.5 L38.5,134.0 L39.0,134.4 L39.2,134.6 L39.9,134.8 L41.4,135.0 L42.2,135.0 L42.9,134.9 L43.2,134.7 L43.5,134.6 L43.9,134.1 L44.0,133.8 L44.0,133.1 L43.8,132.5 L43.0,131.4 L43.0,118.7 L46.1,101.3 L46.2,101.0 L46.4,100.7 L46.6,100.6 L48.0,99.8 L49.1,99.3 L50.8,95.1 L51.3,89.4 L51.3,88.6 L50.1,82.3 L49.2,76.6 L49.3,76.2 L49.6,76.0 L52.7,74.1 L53.8,73.6 L56.6,71.7 L57.1,71.3 L57.4,70.8 L58.3,68.6 L60.9,61.3 L61.1,60.2 L61.8,57.1 L61.8,56.8 L61.5,54.2 L61.4,54.0 L60.9,53.6 L60.3,53.3 L60.1,47.1 L62.6,46.3 L66.2,43.5 L65.8,42.6 L65.5,42.1 L65.1,41.6 L63.8,40.4 L62.5,39.5 L61.7,39.1 L59.6,37.7 L58.0,36.8 L57.6,36.4 L57.4,36.1 L57.5,35.9 L58.3,35.9 L59.8,36.1 L68.8,39.8 L71.2,41.7 L83.1,42.3 L84.4,42.8 L86.2,43.6 L87.1,43.9 L87.8,44.6 L88.3,44.9 L89.0,45.1 L91.4,45.4 L91.6,45.2 L91.5,44.9 L90.2,44.0 L87.0,42.1 L82.6,39.7 L80.6,39.3 L80.3,39.4 L79.1,39.6 L78.0,39.8 L77.8,39.8 L77.6,39.7 L74.5,38.3 L73.5,37.2 L72.5,36.4 L67.1,33.3 L66.3,32.8 L65.7,32.6 L65.4,32.5 L65.0,32.5 L64.7,32.6 L64.5,32.9 L64.5,33.3 L64.6,33.6 L65.1,34.3 L65.7,34.6 L66.3,35.3 L66.4,35.5 L66.5,35.9 L66.4,36.2 L66.2,36.5 L66.0,36.7 L65.6,36.6 L61.7,35.5 L55.8,32.8 L51.3,30.2 L51.0,30.0 L50.9,29.8 L50.6,29.2 L49.8,26.6 L49.8,25.0 L52.5,22.6 L53.0,22.3 L53.3,22.1 L55.3,22.1 L56.2,22.1 L61.3,23.0 L61.9,24.6 L62.6,25.1 L64.2,25.2 L66.3,26.3 L68.1,26.2 L68.5,26.7 L69.5,28.6 L71.0,29.7 L73.1,32.3 L73.3,32.5 L75.8,34.3 L76.5,34.8 L78.0,35.9 L78.3,36.0 L81.4,37.3 L81.3,37.0 L81.1,36.7 L70.9,28.1 L68.0,24.8 L66.7,25.1 L65.9,25.0 L63.9,24.3 L63.7,24.2 L62.9,23.7 L63.9,22.9 L63.9,22.7 L64.0,22.5 L64.1,22.4 L64.2,22.3 L64.5,22.2 L68.9,21.5 L69.3,21.5 L69.6,21.6 L69.8,21.8 L70.0,22.1 L70.0,22.4 L70.2,23.1 L70.4,23.7Z"
                    className="fill-neutral-50 stroke-neutral-300 stroke-[1.2]"
                    strokeLinejoin="round"
                  />

                  {/* Colombo Hub Indicator - Sleek beacon pulse & focal pin */}
                  {(() => {
                    const colomboPin = REGION_PINS.find((p) => p.id === "colombo");
                    const isColomboHighlighted =
                      activeCity !== null &&
                      (colomboPin?.matchedCities.includes(activeCity) ?? false);

                    return (
                      <g
                        className="cursor-pointer"
                        onClick={() => handleLocationClick("Colombo")}
                        onMouseEnter={() => setActiveCity("Colombo")}
                        onMouseLeave={() => setActiveCity(null)}
                      >
                        <title>Colombo (Main Hub)</title>
                        {/* Layer 1: Continuous beacon ripple wave 1 */}
                        <circle
                          cx="45.9"
                          cy="199.8"
                          r="4"
                          fill="#2c4a3e"
                          fillOpacity="0.2"
                          stroke="#2c4a3e"
                          strokeWidth="1.2"
                        >
                          <animate
                            attributeName="r"
                            from="4"
                            to="22"
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            from="0.85"
                            to="0"
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                        </circle>

                        {/* Layer 2: Continuous beacon ripple wave 2 (offset) */}
                        <circle
                          cx="45.9"
                          cy="199.8"
                          r="4"
                          fill="#2c4a3e"
                          fillOpacity="0.2"
                          stroke="#2c4a3e"
                          strokeWidth="1.2"
                        >
                          <animate
                            attributeName="r"
                            from="4"
                            to="22"
                            dur="2.4s"
                            begin="1.2s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            from="0.85"
                            to="0"
                            dur="2.4s"
                            begin="1.2s"
                            repeatCount="indefinite"
                          />
                        </circle>

                        {/* Base resting halo / hover highlight */}
                        <circle
                          cx="45.9"
                          cy="199.8"
                          r={isColomboHighlighted ? 8 : 6.5}
                          fill="#2c4a3e"
                          fillOpacity={isColomboHighlighted ? 0.25 : 0.12}
                          stroke="#2c4a3e"
                          strokeWidth="0.8"
                          strokeOpacity={isColomboHighlighted ? 0.6 : 0.3}
                          className="transition-all duration-200"
                        />
                        {/* Crisp white knockout ring */}
                        <circle
                          cx="45.9"
                          cy="199.8"
                          r={isColomboHighlighted ? 4.5 : 3.8}
                          className="fill-white stroke-[#2c4a3e] stroke-[1.5] transition-all duration-200"
                        />
                        {/* Solid inner center dot */}
                        <circle
                          cx="45.9"
                          cy="199.8"
                          r={isColomboHighlighted ? 2.5 : 2}
                          className="fill-[#2c4a3e] transition-all duration-200"
                        />
                      </g>
                    );
                  })()}

                  {/* Regional City Pins with interactive hover/active states */}
                  {REGION_PINS.filter((p) => !p.isHub).map((pin) => {
                    const isHighlighted =
                      activeCity !== null && pin.matchedCities.includes(activeCity);

                    return (
                      <g
                        key={pin.id}
                        className="cursor-pointer transition-all duration-300"
                        onClick={() => handleLocationClick(pin.name)}
                        onMouseEnter={() => setActiveCity(pin.name)}
                        onMouseLeave={() => setActiveCity(null)}
                      >
                        <title>{pin.name}</title>
                        {/* Highlight ring on hover / active */}
                        {isHighlighted && (
                          <circle
                            cx={pin.cx}
                            cy={pin.cy}
                            r="7"
                            fill="#2c4a3e"
                            fillOpacity="0.2"
                            stroke="#2c4a3e"
                            strokeWidth="1"
                            strokeOpacity="0.6"
                            className="animate-pulse"
                          />
                        )}
                        <circle
                          cx={pin.cx}
                          cy={pin.cy}
                          r={isHighlighted ? 4.2 : 3}
                          className="fill-[#2c4a3e] transition-all duration-200"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* City List with Interactive Bullet Points */}
              <div className="sm:col-span-7">
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-1">
                  {LOCATIONS.map((loc) => {
                    const isMatched = activeCity === loc;
                    const slug = loc.toLowerCase().replace(/\s+/g, "-");
                    return (
                      <li key={loc}>
                        <Link
                          href={`/locations/${slug}`}
                          onMouseEnter={() => setActiveCity(loc)}
                          onMouseLeave={() => setActiveCity(null)}
                          className={`inline-flex cursor-pointer items-center gap-2 text-xs font-medium transition-colors ${
                            isMatched
                              ? "text-brand font-semibold"
                              : "text-neutral-700 hover:text-brand"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full transition-transform ${
                              isMatched ? "scale-150 bg-brand" : "bg-brand"
                            }`}
                          />
                          <span>{loc}</span>
                        </Link>
                      </li>
                    );
                  })}
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
