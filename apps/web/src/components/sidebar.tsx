import Link from "next/link";

import { AccountBlock } from "@/components/account-block";
import { AppNavLinks } from "@/components/app-nav-links";
import { CreditsMeter } from "@/components/credits-meter";
import { cn } from "@/lib/utils";

/**
 * "Album Conceptualizer" in condensed caps. With `fit`, inside a narrow column (the sidebar,
 * the mobile sheet), it never grows past what that column can hold, so enlarged text wraps it
 * between the two words instead of splitting "Conceptualizer": the parent must be a size
 * container (`@container`). "CONCEPTUALIZER" in this cut is 8.44em wide, so 11cqi keeps it
 * to 93% of the column.
 */
export function Wordmark({ className, fit = false }: { className?: string; fit?: boolean }) {
  return (
    <span
      className={cn(
        "type-catalog break-words text-ink",
        fit ? "text-[length:min(0.875rem,11cqi)] leading-5" : "text-sm",
        className,
      )}
    >
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
  return (
    <aside
      aria-label="Workspace"
      className={cn(
        // `w-sidebar` is --sidebar-w (globals.css): 16rem capped at a third of the window, so
        // enlarged text (rem) can never squeeze the page to nothing, and anything that must
        // line up with the content column reads the same width. The whole column scrolls
        // when it is taller than the window (a short landscape screen, 200% text); nothing in
        // it shrinks, so the navigation never collapses.
        "sticky top-0 flex h-dvh w-sidebar shrink-0 flex-col gap-6 overflow-y-auto border-r border-line px-3 py-5 *:shrink-0",
        className,
      )}
    >
      <Link href="/app" className="block rounded px-3 py-1 @container">
        <Wordmark fit />
        <span className="mt-1 block break-words text-xs text-ink-3">{workspaceName}</span>
      </Link>

      <AppNavLinks unreadNotifications={unreadNotifications} />

      {/* Credits and the account block sit at the bottom when there is room. */}
      <div className="mt-auto">
        <CreditsMeter credits={credits} />
      </div>

      <AccountBlock userName={userName} plan={plan} />
    </aside>
  );
}
