import Container from "@/components/layout/Container";
import Logo from "@/components/layout/Logo";
import { getSiteConfiguration, SiteConfiguration } from "@/lib/api";
import { FaFacebook, FaXTwitter, FaTiktok, FaPhone, FaEnvelope, FaLocationDot } from "react-icons/fa6";
import { RiInstagramFill } from "react-icons/ri";
import { IoLogoWhatsapp } from "react-icons/io";

/** Shared by every footer anchor so hover and keyboard focus never diverge. */
const linkClass =
  "rounded-sm transition-colors hover:text-brand focus-visible:ring-2 " +
  "focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

const iconClass = "mt-0.5 size-4 shrink-0 text-brand";

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
      {children}
    </h2>
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

  if (siteConfig?.instagram_link?.show && siteConfig.instagram_link.value) {
    socialLinks.push({
      label: "Instagram",
      href: siteConfig.instagram_link.value,
      icon: <RiInstagramFill aria-hidden="true" className={iconClass} />,
    });
  }
  if (siteConfig?.facebook_link?.show && siteConfig.facebook_link.value) {
    socialLinks.push({
      label: "Facebook",
      href: siteConfig.facebook_link.value,
      icon: <FaFacebook aria-hidden="true" className={iconClass} />,
    });
  }
  if (siteConfig?.x_link?.show && siteConfig.x_link.value) {
    socialLinks.push({
      label: "X",
      href: siteConfig.x_link.value,
      icon: <FaXTwitter aria-hidden="true" className={iconClass} />,
    });
  }
  if (siteConfig?.tiktok_link?.show && siteConfig.tiktok_link.value) {
    socialLinks.push({
      label: "TikTok",
      href: siteConfig.tiktok_link.value,
      icon: <FaTiktok aria-hidden="true" className={iconClass} />,
    });
  }

  if (siteConfig?.whatsapp?.show && siteConfig.whatsapp.value) {
    const sanitized = siteConfig.whatsapp.value.replace(/[^\d+]/g, "");
    socialLinks.push({
      label: "WhatsApp",
      href: `https://wa.me/${sanitized}`,
      icon: <IoLogoWhatsapp aria-hidden="true" className={iconClass} />,
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
                    <FaPhone aria-hidden="true" className={iconClass} />
                    <div className="flex flex-col gap-1">
                      {siteConfig?.phone_numbers?.values?.map((phone, i) => (
                        <a key={i} href={`tel:${phone.replace(/\s+/g, "")}`} className={linkClass}>
                          {phone}
                        </a>
                      ))}
                    </div>
                  </li>
                )}
                {hasEmail && (
                  <li className="flex gap-2.5">
                    <FaEnvelope aria-hidden="true" className={iconClass} />
                    {/*
                      `break-all` is the 375px guard: the address is the longest
                      unbroken string in the footer and would otherwise widen the
                      page rather than wrap.
                    */}
                    <a href={`mailto:${siteConfig?.contact_email?.value}`} className={`${linkClass} break-all`}>
                      {siteConfig?.contact_email?.value}
                    </a>
                  </li>
                )}

                {/* Not a link — a street address has nothing useful to point at.
                    The empty span keeps it aligned with the two rows above. */}
                {hasCity && (
                  <li className="flex gap-2.5">
                    <FaLocationDot aria-hidden="true" className={iconClass} />
                    <span>{siteConfig?.city?.value}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {socialLinks.length > 0 && (
            <div>
              <ColumnHeading>Socials</ColumnHeading>
              <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                {socialLinks.map(({ label, href, icon }) => (
                  <li key={label} className="flex gap-2.5">
                    {icon}
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
            © 2026 Property Advisor
          </p>
        </div>
      </Container>
    </footer>
  );
}
