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
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MobileAppMenu
        workspaceName={workspaceName}
        userName={userName}
        plan={plan}
        credits={credits}
        unreadNotifications={unreadNotifications}
      />

      <TopbarSearch />

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/app/search"
          aria-label="Open search"
          className="grid h-11 w-11 place-items-center rounded text-ink-2 hover:bg-hover hover:text-ink md:hidden"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </Link>
        <TopbarNewAlbum />
      </div>
    </div>
  );
}
