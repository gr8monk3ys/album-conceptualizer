"use client";

import Link from "next/link";
import { useState } from "react";

import { CatalogItems } from "@/components/album-card";
import { LikeToggle } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
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
 * The album's lyric strip: one bar per track, in sequence, full height where the track has
 * written lyrics and a low stub where it doesn't, so each album shows its own shape at a
 * glance. Captioned "Lyrics" so the marks say what they count; a bar, not the spine's theme
 * square, since here a mark means written lyrics, not a theme carried. Hidden from screen
 * readers, which hear one phrase instead.
 */
function LyricStrip({ trackLyrics }: { trackLyrics: boolean[] }) {
  const tracks = trackLyrics.length;
  const withLyrics = trackLyrics.filter(Boolean).length;
  if (!tracks) return null;
  return (
    <p className="mt-2 flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="type-catalog text-xs text-ink-3">
        Lyrics
      </span>
      <span aria-hidden="true" className="flex min-w-0 flex-wrap items-end gap-y-1">
        {trackLyrics.map((written, index) => (
          <span key={index} className="flex h-3 w-2 items-end justify-center">
            <span
              className={
                // Forced colors drop background colours, so the bars switch to system colours.
                written
                  ? "block h-3 w-1 bg-ink forced-colors:bg-[CanvasText]"
                  : "block h-1 w-1 bg-line-strong forced-colors:bg-[GrayText]"
              }
            />
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
 * themes and the first lines of its concept, and a quiet Like toggle. Remix (or Open in
 * Studio, on the viewer's own album) is on the album's page, where it can be read first.
 *
 * The row is a size container. From 40rem the Like toggle sits at the row's end beside the
 * text; below it (a phone, enlarged text) it drops under the catalog line, so the title and
 * concept keep the row's whole width instead of a column squeezed beside the toggle.
 */
export function DiscoverAlbumCard({ album }: { album: DiscoverAlbum }) {
  const [error, setError] = useState<string | null>(null);
  const tracks = album.trackLyrics.length;
  const withLyrics = album.trackLyrics.filter(Boolean).length;

  return (
    <div
      className="@container relative px-1 py-3 transition-colors hover:bg-hover has-[a:focus-visible]:bg-hover"
      data-testid="discover-album-card"
      data-album-id={album.id}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 @min-[40rem]:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
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
        </div>

        {/* Above the stretched link, so the toggle takes its own presses. Under the catalog
            line in a narrow row, its heart lined up with the text's left edge; at the row's
            end from 40rem. */}
        <div className="relative z-10 -ml-3 mt-1 justify-self-start @min-[40rem]:col-start-2 @min-[40rem]:row-span-2 @min-[40rem]:row-start-1 @min-[40rem]:mt-0 @min-[40rem]:ml-0">
          <LikeToggle
            albumId={album.id}
            albumTitle={album.title}
            initialLiked={album.liked}
            initialLikes={album.likes}
            onError={setError}
          />
        </div>

        <div className="min-w-0 @min-[40rem]:col-start-1 @min-[40rem]:row-start-2">
          <LyricStrip trackLyrics={album.trackLyrics} />
          {album.themes.length ? (
            <p className="mt-2 max-w-[65ch] break-words text-sm text-ink-2">
              <span className="text-ink-3">Themes: </span>
              {album.themes.join(" · ")}
            </p>
          ) : null}
          {album.conceptSummary ? (
            <p className="mt-1 line-clamp-4 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2 sm:line-clamp-2">
              {album.conceptSummary}
            </p>
          ) : null}
          <LiveStatus message={error} tone="danger" className="mt-2" />
        </div>
      </div>
    </div>
  );
}
