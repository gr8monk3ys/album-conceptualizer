"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  APP_HELP_ITEM,
  APP_NAV_ITEMS,
  APP_SETTINGS_ITEM,
  isNavItemActive,
} from "@/components/app-navigation";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: (typeof APP_NAV_ITEMS)[number];
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        // The focus ring is drawn inside the row: rows sit 2px apart in a scrolling column, so
        // an outside ring would be clipped by the scroller or painted over by the next row.
        "relative flex min-h-11 items-center gap-3 rounded px-3 text-sm transition-colors focus-visible:-outline-offset-2",
        active
          ? // In forced colors the Selected wash and the saffron bar are dropped, so the
            // current row gets a Highlight outline of its own.
            "bg-selected font-semibold text-ink forced-colors:outline forced-colors:-outline-offset-1 forced-colors:outline-[Highlight]"
          : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {/* The current location is marked in the signal color, and by more than color. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full",
          active ? "bg-accent forced-colors:bg-[Highlight]" : "bg-transparent",
        )}
      />
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-ink-3")} aria-hidden="true" />
      <span className="min-w-0 break-words py-2">{item.label}</span>
      {badge ? (
        <span className="type-figure ml-auto rounded-sm bg-ink px-1.5 text-xs font-semibold text-ground">
          <span className="sr-only">, </span>
          {Math.min(99, badge)}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </Link>
  );
}

export function AppNavLinks({
  unreadNotifications,
  onNavigate,
}: {
  unreadNotifications?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/app";
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {APP_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isNavItemActive(pathname, item.href)}
          badge={item.showUnreadBadge ? unreadNotifications : undefined}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

export function SettingsNavLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/app";
  return (
    <NavLink
      item={APP_SETTINGS_ITEM}
      active={isNavItemActive(pathname, APP_SETTINGS_ITEM.href)}
      onNavigate={onNavigate}
    />
  );
}

/** Help sits with Settings in the account block: a place to look things up, not a destination. */
export function HelpNavLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/app";
  return (
    <NavLink
      item={APP_HELP_ITEM}
      active={isNavItemActive(pathname, APP_HELP_ITEM.href)}
      onNavigate={onNavigate}
    />
  );
}
