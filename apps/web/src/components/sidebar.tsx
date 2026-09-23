import Link from "next/link";

import { AppNavLinks, SettingsNavLink } from "@/components/app-nav-links";
import { CreditsMeter } from "@/components/credits-meter";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("type-catalog break-words text-sm text-ink", className)}>
      Album <span className="font-extrabold">Conceptualizer</span>
    </span>
  );
}

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
  const showUpgrade = plan !== "pro" && plan !== "team";

  return (
    <aside
      aria-label="Workspace"
      className={cn(
        // Capped by the viewport so enlarged text (rem) can never squeeze the page to nothing.
        "sticky top-0 flex h-screen w-64 max-w-[33vw] shrink-0 flex-col gap-6 border-r border-line px-3 py-5",
        className,
      )}
    >
      <Link href="/app" className="block rounded px-3 py-1">
        <Wordmark />
        <span className="mt-1 block break-words text-xs text-ink-3">{workspaceName}</span>
      </Link>

      <div className="flex-1 overflow-auto">
        <AppNavLinks unreadNotifications={unreadNotifications} />
      </div>

      <CreditsMeter credits={credits} />

      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-2 px-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-ink">{userName || "You"}</p>
            <p className="text-xs capitalize text-ink-3">{plan ?? "free"} plan</p>
          </div>
          {showUpgrade ? (
            <Link
              href="/app/settings/billing"
              className="inline-flex min-h-11 items-center rounded px-2 text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Upgrade
            </Link>
          ) : null}
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          <SettingsNavLink />
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
