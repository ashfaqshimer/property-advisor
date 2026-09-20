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
  if (siteConfig?.whatsapp?.show && siteConfig.whatsapp.value) {
    const sanitized = siteConfig.whatsapp.value.replace(/[^\d+]/g, "");
    socialLinks.push({
      label: "WhatsApp",
      href: `https://wa.me/${sanitized}`,
      icon: (
        <path fill="currentColor" stroke="none" d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.061-.301-.15-1.265-.462-2.406-1.474-.888-.788-1.488-1.761-1.663-2.061-.175-.301-.018-.461.132-.611.136-.134.301-.35.452-.523.151-.172.2-.295.302-.495.1-.2.05-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.301-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.302 1.27.485 1.704.62.715.227 1.365.195 1.88.121.574-.08 1.767-.721 2.016-1.426.248-.705.248-1.31.173-1.426-.074-.12-.272-.195-.572-.345zM20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.005c6.58 0 11.939-5.336 11.942-11.895 0-3.178-1.241-6.165-3.472-8.451zM12.045 21.782h-.004c-1.774 0-3.513-.473-5.034-1.365l-.361-.214-3.74.975.992-3.629-.236-.372c-.975-1.554-1.49-3.355-1.49-5.197.003-5.462 4.475-9.914 9.967-9.914 2.656.001 5.15 1.025 7.025 2.89 1.874 1.864 2.906 4.341 2.905 6.98-.003 5.463-4.474 9.915-9.966 9.915z" />
      ),
    });
  }
  if (siteConfig?.instagram_link?.show && siteConfig.instagram_link.value) {
    socialLinks.push({
      label: "Instagram",
      href: siteConfig.instagram_link.value,
      icon: (
        <>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </>
      ),
    });
  }
  if (siteConfig?.facebook_link?.show && siteConfig.facebook_link.value) {
    socialLinks.push({
      label: "Facebook",
      href: siteConfig.facebook_link.value,
      icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
    });
  }
  if (siteConfig?.x_link?.show && siteConfig.x_link.value) {
    socialLinks.push({
      label: "X",
      href: siteConfig.x_link.value,
      icon: <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />,
    });
  }
  if (siteConfig?.tiktok_link?.show && siteConfig.tiktok_link.value) {
    socialLinks.push({
      label: "TikTok",
      href: siteConfig.tiktok_link.value,
      icon: (
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>
      ),
    });
  }

  const hasPhone = siteConfig?.phone_numbers?.show && (siteConfig.phone_numbers.values?.length ?? 0) > 0;
  const hasEmail = siteConfig?.contact_email?.show && !!siteConfig.contact_email.value;
  const hasCity = siteConfig?.city?.show && !!siteConfig.city.value;
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
                      {siteConfig.phone_numbers.values.map((phone, i) => (
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
                    <a href={`mailto:${siteConfig.contact_email.value}`} className={`${linkClass} break-all`}>
                      {siteConfig.contact_email.value}
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
                    <span>{siteConfig.city.value}</span>
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
