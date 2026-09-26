import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isValidElement, type ReactNode } from "react";

import { RelativeTime } from "@/components/relative-time";
import type { ScoreStory } from "@/lib/score-story";
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
   * How far the album has come (server/album-progress.ts): tracks with lyrics written, the
   * Coherence verdict label and the score story every page tells (`@/lib/score-story`). Rows
   * show the story when the page loaded it.
   */
  progress?: {
    tracks: number;
    lyricsWritten: number;
    verdict: string;
    story: Pick<ScoreStory, "headline" | "scoreLine">;
  };
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
 * A catalog item with classes for its whole cell, separator included, e.g. one that a narrow
 * line leaves out (`hidden @min-[30rem]:inline`). Hide only an item that isn't the last: the
 * item before it keeps its separator for the item after.
 */
export type CatalogItem = { content: ReactNode; className: string };

function isCatalogItem(item: ReactNode | CatalogItem): item is CatalogItem {
  return typeof item === "object" && item !== null && !isValidElement(item) && "content" in item && "className" in item;
}

function toCatalogItem(item: ReactNode | CatalogItem): { content: ReactNode; className?: string } {
  return isCatalogItem(item) ? item : { content: item };
}

/**
 * A catalog line (artist · tracks · edited) whose separators end the item before them, so a
 * wrapped line never starts with a dot ("· On Discover"): each separator is inside the item it
 * follows, held to the item's last word by a word joiner (no break opportunity, even after an
 * inline-block link). A line may end on its dot, which reads as "more follows". Items may wrap
 * inside themselves, so a long artist name still fits a narrow screen or 200% text. Use it for
 * every catalog line, including the release header's.
 */
export function CatalogItems({ items }: { items: Array<ReactNode | CatalogItem> }) {
  const shown = items.filter(Boolean).map(toCatalogItem);
  return (
    <>
      {shown.map((item, index) => (
        <span key={index} className={cn("min-w-0 break-words", item.className)}>
          {item.content}
          {index < shown.length - 1 ? (
            <>
              {"\u2060"}
              <span aria-hidden="true" className="ml-2">
                ·
              </span>
            </>
          ) : null}
        </span>
      ))}
    </>
  );
}

/**
 * The One Score Story, as the Coherence report tells it: "Coherence 3 of 8 tracks written ·
 * Unfinished", then "Written tracks 65/100 · Whole album 25/100" (one score once finished).
 */
/** The One Score Story as a catalog line: "Coherence" over the headline, then the scores. */
export function ProgressLine({
  story,
  className = "mt-1.5",
}: {
  story: NonNullable<AlbumListItem["progress"]>["story"];
  className?: string;
}) {
  const { headline, scoreLine } = story;
  return (
    <dl className={cn("flex min-w-0 flex-wrap items-baseline gap-x-2", className)}>
      <dt className="type-catalog text-xs text-ink-3">Coherence</dt>
      <dd className="type-figure min-w-0 text-sm text-ink">
        <span className="font-semibold">{headline}</span>
        {scoreLine ? <span className="block text-ink-2">{scoreLine}</span> : null}
      </dd>
    </dl>
  );
}

/**
 * One album as a catalog row: the title in the display cut, a catalog line beneath it
 * (artist · tracks · edited), how far it has come when the page knows (the Coherence score
 * story), and its status. The whole row is a single link.
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
          {/* Sized by the row (a size container) so an ordinary long word fits whole at 320px
              with 200% text; breaking inside a word is only the last resort. */}
          <p className="type-display break-words text-display-card text-ink hyphens-auto md:text-display-card-lg">
            {album.title}
          </p>
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
          {album.progress?.tracks ? <ProgressLine story={album.progress.story} /> : null}
        </div>
        <div className="flex items-center justify-between gap-3 @min-[20rem]:justify-end">
          <span className="flex min-w-0 flex-wrap items-center gap-3">
            {/* One badge per fact: publishing sets both the status and Discover visibility. */}
            <Chip>{album.isPublic ? "On Discover" : albumStatusLabel(album.status)}</Chip>
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
