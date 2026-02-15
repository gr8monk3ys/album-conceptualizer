import { Filter, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";

export function Topbar({
  title,
  className,
  user,
}: {
  title?: string;
  className?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="text-xs text-[var(--muted2)]">Workspaces</div>
        <div className="truncate text-lg font-semibold tracking-tight text-[var(--text)]">
          {title ?? "My Workspace"}
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center px-3 md:flex">
        <div className="flex w-full max-w-[680px] items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]">
          <Search className="h-4 w-4 text-[var(--muted2)]" />
          <input
            className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none"
            placeholder="Search albums, tracks, creators, or genres"
          />
          <div className="h-5 w-px bg-[rgba(255,255,255,0.08)]" />
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--muted)] hover:bg-[rgba(255,255,255,0.08)]"
            aria-label="Filters"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[rgba(255,255,255,0.08)] md:flex"
        >
          <SlidersHorizontal className="h-4 w-4 text-[var(--muted2)]" />
          Filters
        </button>
        <Link
          href="/app/create"
          className="rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-4 py-2 text-xs font-semibold text-black shadow-[0_14px_40px_rgba(255,62,165,0.18)] hover:brightness-110"
        >
          Create
        </Link>
        {user ? <UserMenu name={user.name} email={user.email} imageUrl={user.image} /> : null}
      </div>
    </div>
  );
}
