import Link from "next/link";
import type { ComponentType } from "react";
import {
  Bell,
  BookOpenText,
  ChevronDown,
  Compass,
  Disc3,
  Home,
  LibraryBig,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isPrimary?: boolean;
};

const nav: NavItem[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/discover", label: "Discover", icon: Compass },
  { href: "/app/create", label: "Create", icon: Plus, isPrimary: true },
  { href: "/app/library", label: "Library", icon: LibraryBig },
  { href: "/app/challenges", label: "Challenges", icon: Sparkles },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/bibles", label: "Bibles", icon: BookOpenText },
  { href: "/app/studio", label: "Studio", icon: Disc3 },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  className,
  workspaceName,
  userName,
  plan,
  credits,
  unreadNotifications,
}: {
  className?: string;
  workspaceName: string;
  userName?: string | null;
  plan?: string | null;
  credits?: { remaining: number; total: number };
  unreadNotifications?: number;
}) {
  const creditsRemaining = credits?.remaining ?? 0;
  const creditsTotal = credits?.total ?? 0;
  const ratio = creditsTotal ? Math.min(1, creditsRemaining / creditsTotal) : 0;
  const planLabel = plan ? `${plan} plan` : "free plan";
  const showUpgrade = plan !== "pro" && plan !== "team";

  return (
    <aside
      className={cn(
        "flex h-[calc(100vh-28px)] w-[280px] flex-col rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <Link href="/app" className="group flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[radial-gradient(circle_at_30%_25%,rgba(255,62,165,0.9),rgba(109,94,252,0.8))] shadow-[0_10px_30px_rgba(109,94,252,0.2)]">
            <span className="text-[13px] font-semibold tracking-wide text-black/80">
              AC
            </span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-[var(--text)]">
              Album Conceptualizer
            </div>
            <div className="text-xs text-[var(--muted2)]">workspace: {workspaceName}</div>
          </div>
        </Link>
        <button
          type="button"
          className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-2 py-2 text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)]"
          aria-label="Switch workspace"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--muted2)]">Credits</div>
          <div className="rounded-full bg-[rgba(50,213,131,0.14)] px-2 py-0.5 text-xs font-medium text-[var(--ok)]">
            {creditsRemaining}
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))]"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-[var(--muted2)]">
          Earn more with daily challenges.
        </div>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-auto pr-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const showNotificationBadge =
            item.href === "/app/notifications" && (unreadNotifications ?? 0) > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]",
                item.isPrimary &&
                  "bg-[linear-gradient(90deg,rgba(109,94,252,0.22),rgba(255,62,165,0.14))] text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
              )}
            >
              <Icon className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--text)]" />
              <span className="truncate">{item.label}</span>
              {showNotificationBadge ? (
                <span className="ml-auto rounded-full bg-[rgba(255,62,165,0.22)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text)]">
                  {Math.min(99, unreadNotifications ?? 0)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35),rgba(255,255,255,0.08))]" />
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium text-[var(--text)]">{userName || "you"}</div>
            <div className="text-xs text-[var(--muted2)]">{planLabel}</div>
          </div>
          {showUpgrade ? (
            <Link
              href="/app/settings/billing"
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/90"
            >
              Upgrade
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
