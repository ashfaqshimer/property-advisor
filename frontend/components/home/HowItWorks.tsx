import Container from "@/components/layout/Container";

const STEPS = [
  {
    step: "01",
    title: "Tell us what you need",
    description:
      "Describe your ideal property in your own words. No forms, no filters, no hassle.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 text-brand"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Let Amaya do the digging",
    description:
      "She understands your requirements, location, budget and priorities.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 text-brand"
        aria-hidden="true"
      >
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Make a smarter decision",
    description:
      "Explore suitable properties, get answers and receive guidance along the way.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 text-brand"
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-20 border-b border-neutral-200/80 bg-white py-16 sm:py-24"
    >
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Section Header */}
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              SIMPLE. CONVERSATIONAL. EFFECTIVE.
            </p>
            <h2
              id="how-it-works-heading"
              className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl"
            >
              How it works
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              Finding your ideal property is easy. Just have a conversation with
              Amaya.
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-8 lg:gap-6">
            {STEPS.map((item, index) => (
              <div
                key={item.step}
                className="relative flex flex-col rounded-2xl border border-neutral-100 bg-[#fbfbfa] p-6 transition-all hover:border-neutral-200 hover:shadow-xs"
              >
                {/* Header row with Icon and optional connecting arrow */}
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-neutral-200/70 shadow-2xs">
                    {item.icon}
                  </div>
                  {index < STEPS.length - 1 && (
                    <span className="hidden sm:inline-block text-neutral-400">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-4"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </div>

                <span className="mt-6 font-display text-2xl font-bold text-ink">
                  {item.step}
                </span>

                <h3 className="mt-2 text-base font-bold text-ink">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
