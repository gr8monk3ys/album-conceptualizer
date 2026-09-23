import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { MobileAppMenu } from "@/components/mobile-app-menu";
import { buttonClass } from "@/components/ui";

export function Topbar({
  workspaceName,
  userName,
  plan,
  credits,
  unreadNotifications,
}: {
  workspaceName: string;
  userName?: string | null;
  plan?: string | null;
  credits?: { remaining: number; total: number };
  unreadNotifications?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <MobileAppMenu
        workspaceName={workspaceName}
        userName={userName}
        plan={plan}
        credits={credits}
        unreadNotifications={unreadNotifications}
      />

      <form action="/app/search" method="get" role="search" className="hidden flex-1 md:block">
        <div className="relative max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          <input
            name="q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search workspace"
            placeholder="Search albums, tracks, lyrics…"
            className="min-h-11 w-full rounded border border-line-control bg-sunken pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/app/search"
          aria-label="Open search"
          className="grid h-11 w-11 place-items-center rounded text-ink-2 hover:bg-hover hover:text-ink md:hidden"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link href="/app/create" className={buttonClass("primary")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New album
        </Link>
      </div>
    </div>
  );
}
