"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

/** The workspace search field; the Search page has its own, so it steps aside there. */
export function TopbarSearch() {
  const pathname = usePathname();
  if (pathname === "/app/search") return <div className="hidden flex-1 md:block" />;
  return (
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
  );
}
