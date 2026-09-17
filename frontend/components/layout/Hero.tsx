import Container from "@/components/layout/Container";
import ChatCta from "@/components/ui/ChatCta";

export default function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="border-b border-neutral-200 bg-band"
    >
      <Container className="py-16 sm:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {/* Full brand lockup — prominent at the top of the hero */}
          <img
            src="/images/property_advisor_logo.svg"
            alt="Property Advisor"
            width={280}
            height={280}
            className="mb-4 sm:w-[340px]"
          />

          <p className="rounded-full bg-band-strong px-3.5 py-1.5 text-xs text-muted">
            Colombo-based 🌴 island-wide reach
          </p>

          {/*
            `text-balance` gives the two near-even lines the mockup shows
            without a hardcoded <br>, which would break at every other width.
            The serif comes from --font-display — still a system stack; see the
            note on that token in globals.css.
          */}
          <h1
            id="hero-heading"
            className="mt-6 font-display text-3xl leading-tight text-balance text-ink sm:text-5xl lg:text-6xl"
          >
            Find your next home in Colombo — and beyond
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Your expert real estate partner across Sri Lanka. Whether you want to 
            buy, sell, rent, or just need advice, we are here to help.
          </p>

          <ChatCta className="mt-9" />
        </div>
      </Container>
    </section>
  );
}
