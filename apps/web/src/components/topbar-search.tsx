"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { buttonClass } from "@/components/ui";

/** The workspace search field; the Search page has its own, so it steps aside there. */
export function TopbarSearch() {
  const pathname = usePathname();
  if (pathname === "/app/search") return <div className="hidden flex-1 md:block" />;
  return (
    <form
      action="/app/search"
      method="get"
      role="search"
      aria-label="Search workspace"
      className="hidden min-w-0 flex-1 md:block"
    >
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

// In the Library, starting another album is the point, so there it is the primary action.
// Everywhere else the page's own work comes first (on Home: continuing the album you were
// writing) and "New album" steps back to secondary; on the create page it would only lead
// to where you already are.
const NEW_ALBUM_PRIMARY = new Set(["/app/library"]);

/** The header's "New album" action, weighted by where you are. */
export function TopbarNewAlbum() {
  const pathname = usePathname() ?? "";
  if (pathname === "/app/create") return null;
  const tone = NEW_ALBUM_PRIMARY.has(pathname) ? "primary" : "secondary";
  return (
    <Link href="/app/create" className={buttonClass(tone)}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span className="max-sm:sr-only">New album</span>
    </Link>
  );
}
