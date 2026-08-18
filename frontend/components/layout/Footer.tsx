import Container from "@/components/layout/Container";
import Logo from "@/components/layout/Logo";

/**
 * Contact details are hardcoded illustrative prototype data, per the spec —
 * not env vars, not a CMS.
 */
const PHONE = "+94 11 200 0000";
const PHONE_HREF = "tel:+94112000000";
const EMAIL = "hello@propertyadvisor.lk";

// TODO: real URLs — no social accounts exist yet, so these are dead anchors.
const SOCIAL_LINKS = [
  { label: "Instagram", href: "#" },
  { label: "Facebook", href: "#" },
  { label: "LinkedIn", href: "#" },
];

/** Shared by every footer anchor so hover and keyboard focus never diverge. */
const linkClass =
  "rounded-sm transition-colors hover:text-brand focus-visible:ring-2 " +
  "focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
      {children}
    </h2>
  );
}

/**
 * `aria-hidden` because the adjacent text already identifies the field — a
 * screen reader gains nothing from "phone" announced before the number.
 */
function ContactIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-4 shrink-0 text-neutral-400"
    >
      {children}
    </svg>
  );
}

export default function Footer() {
  return (
    <footer
      id="contact"
      className="scroll-mt-24 border-t border-neutral-200 bg-neutral-100/50"
    >
      <Container className="py-12 sm:py-14">
        {/* Brand takes half the row; contact and follow split the rest. */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm/6 text-neutral-600">
              Colombo-based, island-wide reach. Thoughtful, AI-guided property
              search across Sri Lanka.
            </p>
          </div>

          <div>
            <ColumnHeading>Contact</ColumnHeading>
            <ul className="mt-4 space-y-3 text-sm text-neutral-600">
              <li className="flex gap-2.5">
                <ContactIcon>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                </ContactIcon>
                <a href={PHONE_HREF} className={linkClass}>
                  {PHONE}
                </a>
              </li>
              <li className="flex gap-2.5">
                <ContactIcon>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </ContactIcon>
                {/*
                  `break-all` is the 375px guard: the address is the longest
                  unbroken string in the footer and would otherwise widen the
                  page rather than wrap.
                */}
                <a href={`mailto:${EMAIL}`} className={`${linkClass} break-all`}>
                  {EMAIL}
                </a>
              </li>
              {/* Not a link — a street address has nothing useful to point at.
                  The empty span keeps it aligned with the two rows above. */}
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="size-4 shrink-0" />
                <span>Ward Place, Colombo 7</span>
              </li>
            </ul>
          </div>

          <div>
            <ColumnHeading>Follow</ColumnHeading>
            <ul className="mt-4 space-y-3 text-sm text-neutral-600">
              {SOCIAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className={linkClass}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-500">
          <p>
            © 2026 Property Advisor — a UI prototype. All imagery is
            illustrative.
          </p>
        </div>
      </Container>
    </footer>
  );
}
