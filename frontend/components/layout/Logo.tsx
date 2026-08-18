/**
 * Brand mark plus wordmark.
 *
 * Shared because the navbar and the footer both show it — extracting on first
 * use avoids the navbar having to un-duplicate it later. The navbar still
 * renders a placeholder and adopts this in its own feature.
 *
 * The mark is drawn with CSS rather than an image file, so there is nothing to
 * load and it inherits colour from the theme token.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/*
        Hidden from assistive tech: the wordmark beside it already reads
        "Property Advisor", and announcing the initial too gives
        "P Property Advisor".
      */}
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-md bg-brand text-sm font-semibold text-white"
      >
        P
      </span>
      <span className="text-lg font-medium tracking-tight text-neutral-900">
        Property Advisor
      </span>
    </span>
  );
}
