import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { TopbarMobileMenuControl, TopbarUserControls } from "@/components/topbar-client-controls";
import { cn } from "@/lib/utils";

export function Topbar({
  title,
  currentPath,
  className,
  user,
  plan,
  credits,
  unreadNotifications,
}: {
  title?: string;
  currentPath: string;
  className?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  plan?: string | null;
  credits?: { remaining: number; total: number };
  unreadNotifications?: number;
}) {
  const workspaceName = title ?? "My Workspace";

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <TopbarMobileMenuControl
          currentPath={currentPath}
          workspaceName={workspaceName}
          userName={user?.name}
          plan={plan}
          credits={credits}
          unreadNotifications={unreadNotifications}
        />
        <div className="min-w-0">
          <div className="text-xs text-[var(--muted2)]">Workspace</div>
          <div className="truncate text-lg font-semibold tracking-tight text-[var(--text)]">
            {workspaceName}
          </div>
        </div>
      </div>

      <form
        action="/app/search"
        method="get"
        role="search"
        className="hidden flex-1 items-center justify-center px-3 md:flex"
      >
        <label htmlFor="workspace-search" className="sr-only">
          Search workspace
        </label>
        <div className="flex w-full max-w-[720px] items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 focus-within:border-[rgba(109,94,252,0.35)] focus-within:ring-2 focus-within:ring-[rgba(109,94,252,0.22)]">
          <button
            type="submit"
            className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(255,255,255,0.04)] text-[var(--muted)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)]"
            aria-label="Search workspace"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            id="workspace-search"
            name="q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none"
            placeholder="Search albums, tracks, creators, or genres…"
            aria-label="Search workspace"
          />
          <Link
            href="/app/search"
            className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)]"
          >
            Open Search
          </Link>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <Link
          href="/app/search"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--text)] hover:bg-[rgba(255,255,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(109,94,252,0.35)] md:hidden"
          aria-label="Open search"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/app/create"
          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-3 py-2 text-xs font-semibold text-black hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.5)] md:px-4"
          aria-label="Create project"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Create</span>
        </Link>
        {user ? (
          <div className="hidden md:flex">
          <TopbarUserControls name={user.name} email={user.email} imageUrl={user.image} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
