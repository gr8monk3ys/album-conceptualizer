import Link from "next/link";

import { APP_NAV_ITEMS, isNavItemActive } from "@/components/app-navigation";
import { cn } from "@/lib/utils";

export function Sidebar({
  className,
  currentPath,
  workspaceName,
  userName,
  plan,
  credits,
  unreadNotifications,
}: {
  className?: string;
  currentPath: string;
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
        "flex h-[calc(100vh-28px)] w-[280px] flex-col rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.24)]",
        className,
      )}
    >
      <div className="px-1">
        <Link href="/app" className="group flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)]">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,rgba(255,62,165,0.9),rgba(109,94,252,0.76))]">
            <span className="text-[13px] font-semibold tracking-wide text-black/80">AC</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-[var(--text)]">
              Album Conceptualizer
            </div>
            <div className="text-xs text-[var(--muted2)]">Workspace · {workspaceName}</div>
          </div>
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-3">
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
        {APP_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(currentPath, item.href);
          const showNotificationBadge = item.showUnreadBadge && (unreadNotifications ?? 0) > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)]",
                active
                  ? "bg-[linear-gradient(90deg,rgba(109,94,252,0.24),rgba(255,62,165,0.16))] text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  : "text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]",
                !active &&
                  item.isPrimary &&
                  "bg-[linear-gradient(90deg,rgba(109,94,252,0.22),rgba(255,62,165,0.14))] text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active || item.isPrimary ? "text-[var(--text)]" : "text-[var(--muted)]",
                )}
                aria-hidden="true"
              />
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

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[rgba(255,255,255,0.08)] text-xs font-semibold text-[var(--text)]">
            {(userName || "Y").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium text-[var(--text)]">{userName || "You"}</div>
            <div className="text-xs text-[var(--muted2)]">{planLabel}</div>
          </div>
          {showUpgrade ? (
            <Link
              href="/app/settings/billing"
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Upgrade
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
