interface NavItem {
  href: string;
  label: string;
  secondary?: boolean;
}

export const NAV: readonly NavItem[] = [
  { href: "/today", label: "Today" },
  { href: "/analysis", label: "Analysis" },
  { href: "/library", label: "Library" },
  { href: "/progress", label: "Progress" },
  { href: "/about", label: "About", secondary: true },
];
