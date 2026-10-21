import Link from "next/link";
import { Search } from "lucide-react";

import { MobileAppMenu } from "@/components/mobile-app-menu";
import { TopbarNewAlbum, TopbarSearch } from "@/components/topbar-search";

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
  // Below 22rem of header (a narrow phone, or 200% text) every control is a 44px icon square
  // with tighter gaps, so the three always fit and New album is never pushed off the edge.
  // The parent is the size container (app/app/layout.tsx).
  return (
    <div className="flex min-w-0 items-center gap-1 @min-[22rem]:gap-3">
      <MobileAppMenu
        workspaceName={workspaceName}
        userName={userName}
        plan={plan}
        credits={credits}
        unreadNotifications={unreadNotifications}
      />

      <TopbarSearch />

      <div className="ml-auto flex items-center gap-1 @min-[22rem]:gap-2">
        {/* Stands in for the search field wherever the field doesn't show. */}
        <Link
          href="/app/search"
          aria-label="Open search"
          title="Open search"
          className="grid h-11 w-11 shrink-0 place-items-center rounded text-ink-2 hover:bg-hover hover:text-ink md:@min-[22rem]:hidden"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </Link>
        <TopbarNewAlbum />
      </div>
    </div>
  );
}
