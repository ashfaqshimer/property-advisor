/**
 * Header navigation links matching the revamp mockup with Services integration:
 * Home, How it works, Services, About
 */
export type NavLink = {
  href: string;
  label: string;
};

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#services", label: "Services" },
  { href: "/#journey", label: "About" },
];
