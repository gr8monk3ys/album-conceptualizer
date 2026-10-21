"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The album's own pages: the first path segment after /app/albums/<id> ("" is the Overview). */
const ALBUM_PAGES = new Set(["", "studio", "bible", "coherence", "sound", "style", "references", "demos", "export", "versions", "inbox"]);

/**
 * The release title: the album screen's h1. On an address inside the album that isn't one of
 * its pages, the not-found view below it is the page's h1 ("This album has no page called …"),
 * so the title is set exactly the same but as a paragraph, and the page still has one h1.
 */
export function ReleaseTitle({ albumId, className, children }: { albumId: string; className?: string; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const base = `/app/albums/${albumId}`;
  const segment = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : "";
  const Tag = ALBUM_PAGES.has(decodeURIComponent(segment)) ? "h1" : "p";
  return <Tag className={className}>{children}</Tag>;
}
