import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { MobileAppMenu } from "@/components/mobile-app-menu";
import { TopbarSearch } from "@/components/topbar-search";
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

      <TopbarSearch />

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
