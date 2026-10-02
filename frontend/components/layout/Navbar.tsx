import Link from "next/link";

import Container from "@/components/layout/Container";
import Logo from "@/components/layout/Logo";
import MobileMenu from "@/components/layout/MobileMenu";
import { NAV_LINKS } from "@/components/layout/nav-links";
import ChatCta from "@/components/ui/ChatCta";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md transition-all">
      <Container>
        <nav aria-label="Main" className="flex h-20 items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link
            href="/"
            className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <Logo variant="vector" />
          </Link>

          {/* Center Links (Desktop) */}
          <ul className="hidden items-center gap-10 md:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const isHome = href === "/";
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isHome ? "page" : undefined}
                    className={`relative py-1 text-sm font-medium transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${
                      isHome
                        ? "text-ink after:absolute after:-bottom-2.5 after:inset-x-0 after:h-0.5 after:rounded-full after:bg-brand"
                        : "text-neutral-600 hover:text-ink"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right CTA */}
          <div className="hidden shrink-0 md:block">
            <ChatCta size="md" label="Talk to Amaya" />
          </div>

          <MobileMenu className="ml-auto md:hidden" />
        </nav>
      </Container>
    </header>
  );
}
