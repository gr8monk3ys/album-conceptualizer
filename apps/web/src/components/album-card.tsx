import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { RelativeTime } from "@/components/relative-time";
import { Chip } from "@/components/ui";
import { cn } from "@/lib/utils";

export type AlbumListItem = {
  id: string;
  title: string;
  artist: string | null;
  trackCount: number;
  status: string;
  isPublic?: boolean;
  /** ISO timestamp of the last edit. */
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

/** The album's status in words ("Draft"), never the raw enum. */
export function albumStatusLabel(status: string) {
  return STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export function toAlbumListItem(album: {
  id: string;
  title: string;
  artist: string | null;
  trackCount: number;
  status: string;
  isPublic?: boolean;
  updatedAt: Date;
}): AlbumListItem {
  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    trackCount: album.trackCount,
    status: album.status,
    isPublic: album.isPublic,
    updatedAt: album.updatedAt.toISOString(),
  };
}

/**
 * A catalog line (artist · tracks · edited) whose separators stay with the item that follows,
 * so a wrapped line never ends on a dangling dot. Items may wrap inside themselves, so a long
 * artist name still fits a narrow screen or 200% text.
 */
export function CatalogItems({ items }: { items: ReactNode[] }) {
  return (
    <>
      {items.filter(Boolean).map((item, index) => (
        <span key={index} className="min-w-0 break-words">
          {index > 0 ? <span aria-hidden="true" className="mr-2">·</span> : null}
          {item}
        </span>
      ))}
    </>
  );
}

/**
 * One album as a catalog row: the title in the display cut, a catalog line beneath it
 * (artist · tracks · edited), and its status. The whole row is a single link.
 */
export function AlbumCard({
  album,
  href,
  hint,
  className,
}: {
  album: AlbumListItem;
  href: string;
  /** Where the row leads, e.g. "Open Bible". Shown at the row's end on wider screens. */
  hint?: ReactNode;
  className?: string;
}) {
  const tracks = `${album.trackCount} ${album.trackCount === 1 ? "track" : "tracks"}`;
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-11 items-center gap-4 px-1 py-3 transition-colors hover:bg-hover",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="type-display break-words text-lg text-ink hyphens-auto md:text-xl">{album.title}</p>
        <p className="type-catalog mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-2">
          <CatalogItems
            items={[
              album.artist || "No artist yet",
              <span key="tracks" className="type-figure">{tracks}</span>,
              <span key="edited">
                Edited <RelativeTime date={album.updatedAt} />
              </span>,
            ]}
          />
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* One badge per fact: publishing sets both the status and Discover visibility. */}
        <Chip>{album.isPublic ? "Published" : albumStatusLabel(album.status)}</Chip>
        {hint ? <span className="hidden text-sm text-ink-2 group-hover:text-ink md:inline">{hint}</span> : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden="true" />
      </div>
    </Link>
  );
}

/** A list of album rows separated by hairlines. */
export function AlbumList({
  albums,
  hrefFor,
  hint,
  label,
}: {
  albums: AlbumListItem[];
  hrefFor: (album: AlbumListItem) => string;
  hint?: ReactNode;
  label?: string;
}) {
  return (
    <ul aria-label={label} className="border-t border-line">
      {albums.map((album) => (
        <li key={album.id} className="border-b border-line">
          <AlbumCard album={album} href={hrefFor(album)} hint={hint} />
        </li>
      ))}
    </ul>
  );
}
