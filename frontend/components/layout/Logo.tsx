/**
 * Brand mark — minimalist house outline icon + "Property Advisor" wordmark.
 * Matches the refined modern aesthetic in the design mockup.
 */
export default function Logo({ className = "" }: { className?: string }) {
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
      <span className="font-bold text-base sm:text-lg tracking-[0.16em] uppercase text-ink">
        Property Advisor
      </span>
    </span>
  );
}
