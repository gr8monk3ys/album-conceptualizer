import type { ComponentType } from "react";
import {
  Bell,
  BookOpenText,
  Compass,
  Disc3,
  Home,
  LibraryBig,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

type AppNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isPrimary?: boolean;
  showUnreadBadge?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/discover", label: "Discover", icon: Compass },
  { href: "/app/create", label: "Create", icon: Plus, isPrimary: true },
  { href: "/app/library", label: "Library", icon: LibraryBig },
  { href: "/app/challenges", label: "Challenges", icon: Sparkles },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/bibles", label: "Bibles", icon: BookOpenText },
  { href: "/app/studio", label: "Studio", icon: Disc3 },
  { href: "/app/notifications", label: "Notifications", icon: Bell, showUnreadBadge: true },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/app") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
