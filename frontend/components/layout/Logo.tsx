import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "vector" | "minimal";
}

/**
 * Brand mark:
 * - "vector": Vector emblem icon + separated text SVG side by side for the Navbar.
 * - "minimal": Lightweight inline SVG house icon + HTML text wordmark for footer.
 */
export default function Logo({
  className = "",
  variant = "minimal",
}: LogoProps) {
  if (variant === "vector") {
    return (
      <span className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
        <Image
          src="/Property_Advisor_Icon.svg"
          alt=""
          width={56}
          height={56}
          className="size-11 sm:size-14 shrink-0 w-auto h-11 sm:h-14 object-contain"
          aria-hidden="true"
          priority
        />
        <Image
          src="/Property_Advisor_Text.svg"
          alt="Property Advisor"
          width={140}
          height={56}
          className="h-10 sm:h-[52px] w-auto shrink-0 object-contain"
          priority
        />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2c4a3e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 sm:size-7 shrink-0 text-brand"
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="font-bold text-base sm:text-lg tracking-[0.16em] uppercase text-ink">
          Property Advisor
        </span>
        <span className="text-[0.6rem] tracking-[0.12em] text-neutral-500 uppercase">
          Better Advice, Brighter Moves
        </span>
      </span>
    </span>
  );
}
