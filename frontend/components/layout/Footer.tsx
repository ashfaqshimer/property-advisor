import Container from "@/components/layout/Container";
import Logo from "@/components/layout/Logo";
import { getSiteConfiguration, SiteConfiguration } from "@/lib/api";

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

export default async function Footer() {
  let siteConfig: SiteConfiguration | null = null;
  try {
    siteConfig = await getSiteConfiguration();
  } catch {
    // Graceful degradation: render without contact info if API fails
  }

  const socialLinks: { label: string; href: string; icon: React.ReactNode }[] = [];
  if (siteConfig?.show_instagram_link && siteConfig.instagram_link) {
    socialLinks.push({
      label: "Instagram",
      href: siteConfig.instagram_link,
      icon: (
        <>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </>
      ),
    });
  }
  if (siteConfig?.show_facebook_link && siteConfig.facebook_link) {
    socialLinks.push({
      label: "Facebook",
      href: siteConfig.facebook_link,
      icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
    });
  }
  if (siteConfig?.show_x_link && siteConfig.x_link) {
    socialLinks.push({
      label: "X",
      href: siteConfig.x_link,
      icon: <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />,
    });
  }
  if (siteConfig?.show_tiktok_link && siteConfig.tiktok_link) {
    socialLinks.push({
      label: "TikTok",
      href: siteConfig.tiktok_link,
      icon: (
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>
      ),
    });
  }

  const hasPhone = siteConfig?.show_phone_numbers && siteConfig.phone_numbers?.length > 0;
  const hasEmail = siteConfig?.show_contact_email && !!siteConfig.contact_email;
  const hasCity = siteConfig?.show_city && !!siteConfig.city;
  const hasContact = hasPhone || hasEmail || hasCity;

  return (
    <footer
      id="contact"
      className="scroll-mt-24 border-t border-neutral-200 bg-neutral-100/50"
    >
      <Container className="py-12 sm:py-14">
        {/* Brand takes half the row; contact and follow split the rest. */}
        <div className="grid grid-cols-2 gap-8 sm:gap-10 lg:grid-cols-4">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm/6 text-neutral-600">
              Colombo-based, island-wide reach. Thoughtful, AI-guided property
              search across Sri Lanka.
            </p>
          </div>

          {hasContact && (
            <div>
              <ColumnHeading>Contact</ColumnHeading>
              <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                {hasPhone && (
                  <li className="flex gap-2.5">
                    <ContactIcon>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                    </ContactIcon>
                    <div className="flex flex-col gap-1">
                      {siteConfig.phone_numbers.map((phone, i) => (
                        <a key={i} href={`tel:${phone.replace(/\s+/g, "")}`} className={linkClass}>
                          {phone}
                        </a>
                      ))}
                    </div>
                  </li>
                )}
                {hasEmail && (
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
                    <a href={`mailto:${siteConfig.contact_email}`} className={`${linkClass} break-all`}>
                      {siteConfig.contact_email}
                    </a>
                  </li>
                )}
                {/* Not a link — a street address has nothing useful to point at.
                    The empty span keeps it aligned with the two rows above. */}
                {hasCity && (
                  <li className="flex gap-2.5">
                    <ContactIcon>
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </ContactIcon>
                    <span>{siteConfig.city}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {socialLinks.length > 0 && (
            <div>
              <ColumnHeading>Follow</ColumnHeading>
              <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                {socialLinks.map(({ label, href, icon }) => (
                  <li key={label} className="flex gap-2.5">
                    <ContactIcon>{icon}</ContactIcon>
                    <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
