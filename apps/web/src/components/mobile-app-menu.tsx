"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";

import { APP_NAV_ITEMS, isNavItemActive } from "@/components/app-navigation";
import { cn } from "@/lib/utils";

export function MobileAppMenu({
  currentPath,
  workspaceName,
  userName,
  plan,
  credits,
  unreadNotifications,
}: {
  currentPath: string;
  workspaceName: string;
  userName?: string | null;
  plan?: string | null;
  credits?: { remaining: number; total: number };
  unreadNotifications?: number;
}) {
  const [open, setOpen] = useState(false);
  const creditsRemaining = credits?.remaining ?? 0;
  const creditsTotal = credits?.total ?? 0;
  const ratio = creditsTotal ? Math.min(1, creditsRemaining / creditsTotal) : 0;
  const planLabel = plan ? `${plan} plan` : "free plan";
  const showUpgrade = plan !== "pro" && plan !== "team";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.05)] text-[var(--text)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)] md:hidden"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-app-menu"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          />

          <div
            id="mobile-app-menu"
            className="absolute inset-x-3 top-3 max-h-[calc(100vh-24px)] overflow-auto rounded-[28px] border border-[var(--border)] bg-[rgba(11,11,16,0.96)] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)] backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Workspace</div>
                <div className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">
                  {workspaceName}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {userName || "You"} · {planLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.05)] text-[var(--text)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)]"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="mt-4 grid grid-cols-1 gap-2">
              {APP_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(currentPath, item.href);
                const showNotificationBadge = item.showUnreadBadge && (unreadNotifications ?? 0) > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)]",
                      active
                        ? "bg-[linear-gradient(90deg,rgba(109,94,252,0.26),rgba(255,62,165,0.18))] text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {showNotificationBadge ? (
                      <span className="rounded-full bg-[rgba(255,62,165,0.22)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text)]">
                        {Math.min(99, unreadNotifications ?? 0)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-[var(--muted2)]">Credits</div>
                  <div className="rounded-full bg-[rgba(50,213,131,0.14)] px-2 py-0.5 text-xs font-medium text-[var(--ok)]">
                    {creditsRemaining}
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))]"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-[var(--muted2)]">
                  Daily challenges are the fastest way to refill.
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-xs text-[var(--muted2)]">Plan</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">{planLabel}</div>
                <div className="mt-2 text-xs text-[var(--muted2)]">
                  Billing, exports, and analytics live inside the app now.
                </div>
                {showUpgrade ? (
                  <Link
                    href="/app/settings/billing"
                    onClick={() => setOpen(false)}
                    className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    Upgrade
                  </Link>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut({ callbackUrl: "/" });
              }}
              className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
