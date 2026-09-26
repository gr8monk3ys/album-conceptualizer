import Link from "next/link";

import { AccountBlock } from "@/components/account-block";
import { AppNavLinks } from "@/components/app-nav-links";
import { CreditsMeter } from "@/components/credits-meter";
import { FadeScroll } from "@/components/fade-scroll";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

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
        // line up with the content column reads the same width.
        "sticky top-0 flex h-dvh w-sidebar shrink-0 flex-col border-r border-line",
        className,
      )}
    >
      {/* The whole column scrolls when it is taller than the window (a short landscape
          screen, 200% text), and fades at the edge with more past it so that shows; nothing
          in it shrinks, so the navigation never collapses. The scroller sits inside the
          aside so the fade leaves the aside's hairline edge alone. */}
      <FadeScroll className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5 *:shrink-0">
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
      </FadeScroll>
    </aside>
  );
}
