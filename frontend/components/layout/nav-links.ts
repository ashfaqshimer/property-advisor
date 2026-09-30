/**
 * Header navigation links matching the revamp mockup:
 * Home, How it works, About
 */
export type NavLink = {
  href: string;
  label: string;
};

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#journey", label: "About" },
];
