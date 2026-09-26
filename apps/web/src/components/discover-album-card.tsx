"use client";

import Link from "next/link";
import { useState } from "react";

import { CatalogItems } from "@/components/album-card";
import { LikeToggle } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
import { ThemeMark } from "@/components/theme-mark";
import { LiveStatus } from "@/components/ui";
import { lyricStripPhrase, writtenSummaryItems } from "@/lib/discover";

type DiscoverAlbum = {
  id: string;
  title: string;
  artist: string | null;
  conceptSummary: string | null;
  primaryGenre: string | null;
  /** Whether each track, in sequence, has written lyrics (per @/lib/lyrics). */
  trackLyrics: boolean[];
  /** The album's central themes, in the artist's order. */
  themes: string[];
  /** The viewer's own album: the catalog line says so. */
  isOwn: boolean;
  publishedAt: string | null;
  likes: number;
  liked: boolean;
};

/**
 * The album's tiny spine: one mark per track, in sequence, filled where the track has written
 * lyrics and a dot where it doesn't (the spine's ThemeMark), so each album shows its own shape
 * at a glance. Hidden from screen readers, which hear one phrase instead.
 */
function LyricStrip({ trackLyrics }: { trackLyrics: boolean[] }) {
  const tracks = trackLyrics.length;
  const withLyrics = trackLyrics.filter(Boolean).length;
  if (!tracks) return null;
  return (
    <p className="mt-2 flex min-w-0 items-center">
      <span aria-hidden="true" className="flex flex-wrap items-center gap-y-1">
        {trackLyrics.map((written, index) => (
          <span key={index} className="grid h-3 w-3.5 place-items-center">
            <ThemeMark carries={written} />
          </span>
        ))}
      </span>
      <span className="sr-only">{lyricStripPhrase({ tracks, withLyrics })}</span>
    </p>
  );
}

/**
 * One published album as a row: the title at title size (the row's link to the album's
 * Discover page, stretched over the row), the catalog line, the album's lyric strip, its
 * themes and the first lines of its concept, and a quiet Like toggle at the end. Remix (or
 * Open in Studio, on the viewer's own album) is on the album's page, where it can be read
 * first.
 */
export function DiscoverAlbumCard({ album }: { album: DiscoverAlbum }) {
  const [error, setError] = useState<string | null>(null);
  const tracks = album.trackLyrics.length;
  const withLyrics = album.trackLyrics.filter(Boolean).length;

  // Like sits beside the text while the text keeps at least 12rem, and wraps under it below
  // that (a phone at 200% text).
  return (
    <div
      className="relative flex flex-wrap items-start gap-x-6 gap-y-1 px-1 py-3 transition-colors hover:bg-hover has-[a:focus-visible]:bg-hover"
      data-testid="discover-album-card"
      data-album-id={album.id}
    >
      <div className="min-w-0 flex-[1_1_12rem]">
        {/* A block link stretched over the row, so the whole row is the target. `wrap-anywhere`
            breaks a long unspaced title inside the column instead of pushing the page. */}
        <Link
          href={`/app/discover/${album.id}`}
          className="block max-w-full text-lg font-semibold text-ink wrap-anywhere hyphens-auto after:absolute after:inset-0"
        >
          {album.title}
        </Link>
        <p className="type-catalog mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-2">
          <CatalogItems
            items={[
              album.artist || "Artist not named",
              album.primaryGenre,
              ...writtenSummaryItems({ tracks, withLyrics }).map((item) => (
                <span key={item} className="type-figure">
                  {item}
                </span>
              )),
              album.isOwn ? "Your album" : null,
              album.publishedAt ? (
                <span key="published">
                  Published <RelativeTime date={album.publishedAt} />
                </span>
              ) : null,
            ]}
          />
        </p>
        <LyricStrip trackLyrics={album.trackLyrics} />
        {album.themes.length ? (
          <p className="mt-2 max-w-[65ch] break-words text-sm text-ink-2">
            <span className="text-ink-3">Themes: </span>
            {album.themes.join(" · ")}
          </p>
        ) : null}
        {album.conceptSummary ? (
          <p className="mt-1 line-clamp-4 sm:line-clamp-2 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
            {album.conceptSummary}
          </p>
        ) : null}
        <LiveStatus message={error} tone="danger" className="mt-2" />
      </div>

      {/* Above the stretched link, so the toggle takes its own presses. */}
      <div className="relative z-10">
        <LikeToggle
          albumId={album.id}
          albumTitle={album.title}
          initialLiked={album.liked}
          initialLikes={album.likes}
          onError={setError}
        />
      </div>
    </div>
  );
}
