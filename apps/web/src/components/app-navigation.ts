import type { ComponentType } from "react";
import { Bell, CircleHelp, Compass, Home, LibraryBig, Settings, Sparkles } from "lucide-react";

type AppNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  showUnreadBadge?: boolean;
};

// Five places to go; creating an album is the topbar's primary action and search lives in
// the topbar, so neither repeats here.
export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/library", label: "Library", icon: LibraryBig },
  { href: "/app/discover", label: "Discover", icon: Compass },
  { href: "/app/challenges", label: "Challenges", icon: Sparkles },
  { href: "/app/notifications", label: "Notifications", icon: Bell, showUnreadBadge: true },
];

export const APP_SETTINGS_ITEM: AppNavItem = { href: "/app/settings", label: "Settings", icon: Settings };

export const APP_HELP_ITEM: AppNavItem = { href: "/app/help", label: "Help", icon: CircleHelp };

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/app") return pathname === href;
  // An album belongs to the Library.
  if (href === "/app/library" && pathname.startsWith("/app/albums/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
