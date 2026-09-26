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
  /**
   * How far the album has come (server/album-progress.ts): tracks with lyrics written, and
   * the Coherence verdict label. Rows show it when the page loaded it.
   */
  progress?: { tracks: number; lyricsWritten: number; verdict: string };
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
 * so a wrapped line never ends on a dangling dot: each separator is inside its item, joined
 * to the item's first word with no break opportunity between them. Items may wrap inside
 * themselves, so a long artist name still fits a narrow screen or 200% text. Use it for every
 * catalog line, including the release header's.
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

/** "Lyrics written 3/8 · Coherence Unfinished": the figures Home shows for the album it continues. */
function ProgressLine({ progress }: { progress: NonNullable<AlbumListItem["progress"]> }) {
  const { tracks, lyricsWritten, verdict } = progress;
  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <dt className="type-catalog text-xs text-ink-3">Lyrics written</dt>
        <dd className="type-figure text-sm font-semibold text-ink">
          <span aria-hidden="true">
            {lyricsWritten}/{tracks}
          </span>
          <span className="sr-only">
            {lyricsWritten} of {tracks} {tracks === 1 ? "track" : "tracks"}
          </span>
        </dd>
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <dt className="type-catalog text-xs text-ink-3">Coherence</dt>
        <dd className="text-sm font-semibold text-ink">{verdict}</dd>
      </div>
    </dl>
  );
}

/**
 * One album as a catalog row: the title in the display cut, a catalog line beneath it
 * (artist · tracks · edited), how far it has come when the page knows (lyrics written, the
 * Coherence verdict), and its status. The whole row is a single link.
 *
 * The row is a size container: with 20rem or more the status sits at the row's end and the
 * title keeps at least 12rem; with less (a narrow phone, 200% text) the status and chevron
 * drop below the catalog line and the title has the whole width.
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
      className={cn("group @container block min-h-11 px-1 py-3 transition-colors hover:bg-hover", className)}
    >
      <div className="flex flex-col gap-2 @min-[20rem]:flex-row @min-[20rem]:items-center @min-[20rem]:gap-4">
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
          {album.progress?.tracks ? <ProgressLine progress={album.progress} /> : null}
        </div>
        <div className="flex items-center justify-between gap-3 @min-[20rem]:justify-end">
          <span className="flex min-w-0 flex-wrap items-center gap-3">
            {/* One badge per fact: publishing sets both the status and Discover visibility. */}
            <Chip>{album.isPublic ? "Published" : albumStatusLabel(album.status)}</Chip>
            {hint ? <span className="hidden text-sm text-ink-2 group-hover:text-ink md:inline">{hint}</span> : null}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden="true" />
        </div>
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
