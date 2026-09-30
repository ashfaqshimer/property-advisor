import Link from "next/link";
import Container from "@/components/layout/Container";
import Logo from "@/components/layout/Logo";
import { getSiteConfiguration, SiteConfiguration } from "@/lib/api";
import {
  FaFacebook,
  FaXTwitter,
  FaPhone,
  FaEnvelope,
  FaLocationDot,
  FaLinkedin,
} from "react-icons/fa6";
import { RiInstagramFill } from "react-icons/ri";

const linkClass =
  "rounded-sm transition-colors hover:text-brand focus-visible:ring-2 " +
  "focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

const iconClass = "size-4 text-neutral-600 hover:text-brand transition-colors";

export default async function Footer() {
  let siteConfig: SiteConfiguration | null = null;
  try {
    siteConfig = await getSiteConfiguration();
  } catch {
    // Graceful degradation
  }

  const socialLinks: { label: string; href: string; icon: React.ReactNode }[] = [];

  // Facebook
  socialLinks.push({
    label: "Facebook",
    href: siteConfig?.facebook_link?.value || "https://facebook.com",
    icon: <FaFacebook aria-hidden="true" className={iconClass} />,
  });

  // Instagram
  socialLinks.push({
    label: "Instagram",
    href: siteConfig?.instagram_link?.value || "https://instagram.com",
    icon: <RiInstagramFill aria-hidden="true" className={iconClass} />,
  });

  // LinkedIn
  socialLinks.push({
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: <FaLinkedin aria-hidden="true" className={iconClass} />,
  });

  // X / Twitter
  socialLinks.push({
    label: "X",
    href: siteConfig?.x_link?.value || "https://x.com",
    icon: <FaXTwitter aria-hidden="true" className={iconClass} />,
  });

  const hasPhone =
    siteConfig?.phone_numbers?.show &&
    (siteConfig.phone_numbers.values?.length ?? 0) > 0;
  const hasEmail =
    siteConfig?.contact_email?.show && !!siteConfig.contact_email.value;
  const hasCity = siteConfig?.city?.show && !!siteConfig.city.value;

  return (
    <footer
      id="contact"
      role="contentinfo"
      className="scroll-mt-24 border-t border-neutral-200/80 bg-white"
    >
      <Container className="py-14 sm:py-16">
        {/* Top Row: Brand & Tagline, Navigation, Socials */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand Column (Left) */}
          <div className="lg:col-span-5">
            <Link href="/" className="inline-block">
              <Logo />
            </Link>
            <p className="mt-3 text-xs tracking-wider text-neutral-500 uppercase">
              Find better. Understand more.
            </p>
          </div>

          {/* Quick Nav Links (Center) */}
          <div className="lg:col-span-4">
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-neutral-600">
              <li>
                <Link href="/" className={linkClass}>
                  Home
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className={linkClass}>
                  How it works
                </Link>
              </li>
              <li>
                <Link href="#services" className={linkClass}>
                  Services
                </Link>
              </li>
              <li>
                <Link href="#journey" className={linkClass}>
                  About
                </Link>
              </li>
              <li>
                <Link href="#contact" className={linkClass}>
                  Contact
                </Link>
              </li>
            </ul>

            {/* Optional contact details if configured */}
            {(hasPhone || hasEmail || hasCity) && (
              <div className="mt-5 space-y-2 text-xs text-neutral-500 border-t border-neutral-100 pt-4">
                {hasEmail && (
                  <p className="flex items-center gap-2">
                    <FaEnvelope className="size-3 text-neutral-400" />
                    <span>{siteConfig?.contact_email?.value}</span>
                  </p>
                )}
                {hasPhone && (
                  <p className="flex items-center gap-2">
                    <FaPhone className="size-3 text-neutral-400" />
                    <span>{siteConfig?.phone_numbers?.values?.[0]}</span>
                  </p>
                )}
                {hasCity && (
                  <p className="flex items-center gap-2">
                    <FaLocationDot className="size-3 text-neutral-400" />
                    <span>{siteConfig?.city?.value}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Follow Us & Social Icons (Right) */}
          <div className="flex flex-col sm:items-end lg:col-span-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Follow us
            </p>
            <div className="mt-3 flex items-center gap-4">
              {socialLinks.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-8 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row: Copyright + Location Indicator */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200/80 pt-8 sm:flex-row text-xs text-neutral-500">
          <p>© 2026 Property Advisor. All rights reserved.</p>

          <div className="inline-flex items-center gap-1.5 font-medium text-neutral-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 text-neutral-500"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <span>Sri Lanka</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
