/**
 * Brand mark — icon SVG + "Property Advisor" wordmark as text, side by side.
 * Sized to fill the h-24 navbar comfortably.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 md:gap-3 ${className}`}>
      <img
        src="/images/property_advisor_icon.svg"
        alt=""
        aria-hidden="true"
        className="h-10 md:h-16 w-auto shrink-0"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-lg md:text-2xl font-bold tracking-tight text-[#164f3b]">
          Property
        </span>
        <span className="text-lg md:text-2xl font-bold tracking-tight text-[#789866]">
          Advisor
        </span>
      </span>
    </span>
  );
}

