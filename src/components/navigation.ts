import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  LineChart,
  BookOpen,
  TrendingUp,
  Info,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  secondary?: boolean;
}

export const NAV: readonly NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/analysis", label: "Analysis", icon: LineChart },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/about", label: "About", icon: Info, secondary: true },
];
