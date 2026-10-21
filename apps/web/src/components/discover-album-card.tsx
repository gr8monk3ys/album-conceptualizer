"use client";

import Link from "next/link";
import { useState } from "react";

import { CatalogItems } from "@/components/album-card";
import { LikeToggle } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
import { LiveStatus } from "@/components/ui";
import { softHyphens } from "@/lib/soft-hyphens";
import {
  THEME_STRIP_PITCH,
  lyricStripPhrase,
  themeStripPaths,
  themeThreadPhrase,
  writtenSummaryItems,
} from "@/lib/discover";

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
  /** For each theme, whether each track in sequence carries it (`themeTrackMarks`). */
  themeTracks: boolean[][];
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
 * A theme strip's height, one mark's pitch: 8px at normal text size, the lyric strip's pitch,
 * so both strips give a track the same width. In rem, so it scales with the text.
 */
const STRIP_HEIGHT_REM = 0.5;

/**
 * The album's themes, each followed by its thread through the sequence: one mark per track, a
 * small square where the track carries the theme and a dot where it doesn't (the spine's
 * ThemeMark at strip size, so a square means a theme carried here too), so a theme that runs
 * through the whole record reads apart from one that turns up once. The one piece of each
 * album's own shape a list row carries beside its lyric strip; drawn as two paths a theme, so
 * twenty rows stay cheap. Before any track is tagged every strip would be dots, so the names
 * stand alone. Screen readers hear the line as one sentence ("Themes: isolation on 6 of 8
 * tracks, signal on every track.").
 */
function ThemeThreads({ themes, themeTracks }: { themes: string[]; themeTracks: boolean[][] }) {
  if (!themes.length) return null;
  const threaded = themeTracks.some((marks) => marks.some(Boolean));
  if (!threaded) {
    return (
      <p className="mt-2 max-w-[65ch] break-words text-sm text-ink-2">
        <span className="text-ink-3">Themes: </span>
        {themes.join(" · ")}
      </p>
    );
  }
  return (
    // Not held to 65ch like the concept below it: names and strips, not running text, so the
    // line may use the row's width before it wraps. Screen readers hear it as one sentence.
    <p className="mt-2 text-sm text-ink-2">
      <span className="sr-only">
        {`Themes: ${themes.map((theme, index) => `${theme} ${themeThreadPhrase(themeTracks[index] ?? [])}`).join(", ")}.`}
      </span>
      <span aria-hidden="true" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ink-3">Themes:</span>
        {themes.map((theme, index) => {
          const strip = themeStripPaths(themeTracks[index] ?? []);
          const tracks = strip.width / THEME_STRIP_PITCH;
          return (
            // Wraps inside itself too: in a narrow row (a phone at 200% text) the strip drops
            // under its name rather than squeezing it.
            <span key={theme} className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5">
              <span className="min-w-0 break-words">{theme}</span>
              {tracks ? (
                <svg
                  viewBox={`0 0 ${strip.width} ${THEME_STRIP_PITCH}`}
                  width={`${tracks * STRIP_HEIGHT_REM}rem`}
                  height={`${STRIP_HEIGHT_REM}rem`}
                  className="shrink-0"
                >
                  <path d={strip.off} className="fill-line-strong forced-colors:fill-[GrayText]" />
                  <path d={strip.on} className="fill-ink forced-colors:fill-[CanvasText]" />
                </svg>
              ) : null}
            </span>
          );
        })}
      </span>
    </p>
  );
}

/**
 * One published album as a row: the title at title size (the row's link to the album's
 * Discover page, stretched over the row), the catalog line, the album's lyric strip, its
 * themes with their threads through the sequence, the first lines of its concept, and a quiet
 * Like toggle. Remix (or Open in
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
          {/* A block link stretched over the row, so the whole row is the target. The title steps
              down in a narrow row (9% of it, never under 1rem), so a thirteen-letter word stays
              whole at 320px with 200% text; `wrap-anywhere` is only the last resort. */}
          <Link
            href={`/app/discover/${album.id}`}
            className="block max-w-full text-[length:max(1rem,min(1.125rem,9cqi))] font-semibold leading-snug text-ink wrap-anywhere hyphens-auto after:absolute after:inset-0"
          >
            {softHyphens(album.title)}
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
          <ThemeThreads themes={album.themes} themeTracks={album.themeTracks} />
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
