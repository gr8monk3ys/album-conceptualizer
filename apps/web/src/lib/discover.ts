// What a published album shows on Discover before anyone spends credits on it: how much is
// written and a few lines of each track's lyrics. Read leniently from the album
// snapshot; "written" always means what @/lib/lyrics says it means.

import { isWrittenLyrics } from "@/lib/lyrics";
import { asList } from "@/lib/snapshot-values";

type Raw = Record<string, unknown>;

function songsOf(data: unknown): Raw[] {
  return asList((data as { songs?: unknown } | null)?.songs)
    .filter((raw): raw is Raw => Boolean(raw) && typeof raw === "object")
    .filter((song) => typeof song.track_number === "number" && typeof song.title === "string");
}

/**
 * ["7 tracks", "lyrics on 5"]: the track count and how many tracks have any written lyrics
 * (count those with `getSpineRows`, whose `lyricSections` follows @/lib/lyrics), as two
 * catalog items. `CatalogItems` joins them, so no separator is baked into the text.
 */
export function writtenSummaryItems({ tracks, withLyrics }: { tracks: number; withLyrics: number }): string[] {
  const count = `${tracks} ${tracks === 1 ? "track" : "tracks"}`;
  if (!tracks) return [count];
  if (!withLyrics) return [count, "no lyrics yet"];
  if (withLyrics === tracks) return [count, "lyrics on all"];
  return [count, `lyrics on ${withLyrics}`];
}

/**
 * The card's lyric strip in one phrase for screen readers: "Lyrics written on 5 of 7 tracks".
 */
export function lyricStripPhrase({ tracks, withLyrics }: { tracks: number; withLyrics: number }): string {
  if (!tracks) return "";
  if (!withLyrics) return `No lyrics written yet on ${tracks === 1 ? "its 1 track" : `its ${tracks} tracks`}`;
  if (withLyrics === tracks) return tracks === 1 ? "Lyrics written on its 1 track" : `Lyrics written on all ${tracks} tracks`;
  return `Lyrics written on ${withLyrics} of ${tracks} tracks`;
}

/**
 * Where each album theme runs through the sequence: for each theme (in the album's order), one
 * entry per track in sequence, true where the track carries it. `rows` are the spine's rows
 * (`getSpineRows`), whose theme keys are already lower-cased.
 */
export function themeTrackMarks(themes: readonly string[], rows: ReadonlyArray<{ themeKeys: readonly string[] }>): boolean[][] {
  return themes.map((theme) => {
    const key = theme.trim().toLowerCase();
    return rows.map((row) => row.themeKeys.includes(key));
  });
}

/** One theme's thread in words, for screen readers: "on 5 of 8 tracks", "on every track". */
export function themeThreadPhrase(marks: readonly boolean[]): string {
  const tracks = marks.length;
  const carried = marks.filter(Boolean).length;
  if (!carried) return "on no track yet";
  if (carried === tracks) return tracks === 1 ? "on its 1 track" : "on every track";
  return `on ${carried} of ${tracks} ${tracks === 1 ? "track" : "tracks"}`;
}

/** The pitch of a theme strip's marks, and the sizes of its square and dot, in SVG units. */
export const THEME_STRIP_PITCH = 8;
const STRIP_SQUARE = 4;
const STRIP_DOT = 2;

/**
 * A theme's thread drawn as two SVG paths, so a row of the Discover list costs two elements a
 * theme however long the album is: `on` holds a square for each track that carries the theme,
 * `off` a small dot for each that doesn't (the spine's ThemeMark, at strip size), one
 * `THEME_STRIP_PITCH` apart, in sequence; `width` is the strip's width in the same units.
 */
export function themeStripPaths(marks: readonly boolean[]): { on: string; off: string; width: number } {
  const on: string[] = [];
  const off: string[] = [];
  marks.forEach((carries, index) => {
    const x = index * THEME_STRIP_PITCH;
    if (carries) {
      const inset = (THEME_STRIP_PITCH - STRIP_SQUARE) / 2;
      on.push(`M${x + inset} ${inset}h${STRIP_SQUARE}v${STRIP_SQUARE}h-${STRIP_SQUARE}z`);
    } else {
      const inset = (THEME_STRIP_PITCH - STRIP_DOT) / 2;
      off.push(`M${x + inset} ${inset}h${STRIP_DOT}v${STRIP_DOT}h-${STRIP_DOT}z`);
    }
  });
  return { on: on.join(""), off: off.join(""), width: marks.length * THEME_STRIP_PITCH };
}

/**
 * The Like toggle's accessible name: "Like Salt Year" / "Liked Salt Year" in a list, where each
 * row's toggle must be told apart, or plain "Like" / "Liked" where the page names the album.
 */
/**
 * The Like toggle's name. It stays the same whether or not the album is liked: `aria-pressed`
 * carries the state, so a screen reader says "Like Salt Year, pressed", never "Liked …, pressed".
 */
export function likeToggleName(albumTitle?: string) {
  return albumTitle?.trim() ? `Like ${albumTitle}` : "Like";
}

const MAX_EXCERPT_LINE = 90;

/**
 * The first written lines of a track, in section order, with "[…]" placeholders removed. An
 * excerpt, not the lyric sheet: at most `maxLines` lines, each clipped to a readable length.
 */
export function lyricExcerpt(sections: unknown, maxLines = 2): string[] {
  const ordered = asList(sections)
    .filter((raw): raw is Raw => Boolean(raw) && typeof raw === "object")
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const ao = typeof a.section.order === "number" ? a.section.order : a.index;
      const bo = typeof b.section.order === "number" ? b.section.order : b.index;
      return ao - bo || a.index - b.index;
    });
  const lines: string[] = [];
  for (const { section } of ordered) {
    if (!isWrittenLyrics(section.lyrics)) continue;
    const text = (section.lyrics as string).replace(/\[[^\]]*\]/g, "");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;
      lines.push(line.length > MAX_EXCERPT_LINE ? `${line.slice(0, MAX_EXCERPT_LINE).trimEnd()}…` : line);
      if (lines.length === maxLines) return lines;
    }
  }
  return lines;
}

/** Each track's lyric excerpt, keyed by track number. */
export function lyricExcerptsByTrack(data: unknown, maxLines = 2): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const song of songsOf(data)) {
    out.set(song.track_number as number, lyricExcerpt(song.sections, maxLines));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Browsing Discover: sort and filter, read from and written to the URL so a view is linkable.
// ---------------------------------------------------------------------------------------------

export type DiscoverSort = "newest" | "written" | "liked";
export type DiscoverShow = "all" | "finished";

export const DISCOVER_SORTS: ReadonlyArray<{ value: DiscoverSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "written", label: "Most written" },
  { value: "liked", label: "Most liked" },
];

export const DISCOVER_SHOWS: ReadonlyArray<{ value: DiscoverShow; label: string }> = [
  { value: "all", label: "All albums" },
  { value: "finished", label: "Finished only" },
];

export type DiscoverView = {
  /** The search text, trimmed; searched only from two characters. */
  q: string;
  sort: DiscoverSort;
  show: DiscoverShow;
  /** A primary genre to keep, compared without case; null for every genre. */
  genre: string | null;
  /** The page of the list, from 1. */
  page: number;
};

export const DEFAULT_DISCOVER_VIEW: DiscoverView = { q: "", sort: "newest", show: "all", genre: null, page: 1 };

/** Albums on one page of Discover. */
export const DISCOVER_PAGE_SIZE = 20;
/** The highest page a URL may ask for; anything past the last page is sent back to it. */
const MAX_PAGE = 500;

type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return "";
}

function parsePage(value: string): number {
  if (!/^\d{1,6}$/.test(value)) return 1;
  return Math.min(Math.max(Number(value), 1), MAX_PAGE);
}

/** The Discover view a URL asks for; unknown values fall back to the defaults. */
export function parseDiscoverView(params: SearchParamsRecord): DiscoverView {
  const sort = firstParam(params.sort);
  const show = firstParam(params.show);
  const genre = firstParam(params.genre).slice(0, 80);
  return {
    q: firstParam(params.q).slice(0, 200),
    sort: DISCOVER_SORTS.some((option) => option.value === sort) ? (sort as DiscoverSort) : "newest",
    show: show === "finished" ? "finished" : "all",
    genre: genre || null,
    page: parsePage(firstParam(params.page)),
  };
}

/**
 * The URL for a Discover view; defaults are left out, so the plain view is `/app/discover`.
 * The page is kept only when it is past the first; a link that changes the search, sort or
 * filter passes `page: 1` (or leaves it out) so it starts the new list from the top.
 */
export function discoverHref(view: Partial<DiscoverView>): string {
  const full = { ...DEFAULT_DISCOVER_VIEW, ...view };
  const params = new URLSearchParams();
  if (full.q.trim()) params.set("q", full.q.trim());
  if (full.sort !== "newest") params.set("sort", full.sort);
  if (full.show !== "all") params.set("show", full.show);
  if (full.genre) params.set("genre", full.genre);
  if (full.page > 1) params.set("page", String(full.page));
  const query = params.toString();
  return query ? `/app/discover?${query}` : "/app/discover";
}

/**
 * The same view without its search: sort, "Finished only" and the genre stay as they were,
 * so clearing a search never quietly widens the list.
 */
export function clearSearchHref(view: DiscoverView): string {
  return discoverHref({ ...view, q: "", page: 1 });
}

/** The same search without its narrowing: every album, still in the chosen order. */
export function widenViewHref(view: DiscoverView): string {
  return discoverHref({ q: view.q, sort: view.sort, page: 1 });
}

export type DiscoverPage = {
  /** The page shown, clamped to the pages there are (1 when the list is empty). */
  page: number;
  pageCount: number;
  /** Index of the first album on the page, and one past the last (for `slice`). */
  start: number;
  end: number;
};

/** Which slice of `total` albums a page shows. */
export function discoverPage(total: number, page: number, pageSize = DISCOVER_PAGE_SIZE): DiscoverPage {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * pageSize;
  return { page: current, pageCount, start, end: Math.min(start + pageSize, total) };
}

/** True when the view narrows or reorders the plain list. */
export function isNarrowedView(view: DiscoverView): boolean {
  return view.show !== "all" || Boolean(view.genre);
}

/** What sorting and filtering need to know about one published album. */
export type DiscoverRankable = {
  /** Tracks on the album and how many have written lyrics (per @/lib/lyrics). */
  tracks: number;
  withLyrics: number;
  likes: number;
  publishedAt: string | null;
  primaryGenre: string | null;
};

/** Finished means what the Coherence report means: every track has written lyrics. */
export function isFinishedAlbum({ tracks, withLyrics }: Pick<DiscoverRankable, "tracks" | "withLyrics">) {
  return tracks > 0 && withLyrics >= tracks;
}

function publishedTime(value: string | null) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

/**
 * The albums a view shows, in its order: filtered to finished albums and/or one genre, then
 * sorted newest first, by tracks with written lyrics (the share breaks ties), or by likes.
 * Every tie falls back to newest first, so the order is stable.
 */
export function arrangeDiscoverAlbums<T extends DiscoverRankable>(
  albums: readonly T[],
  view: Pick<DiscoverView, "sort" | "show" | "genre">,
): T[] {
  const genre = view.genre?.trim().toLowerCase() || null;
  const kept = albums.filter(
    (album) =>
      (view.show !== "finished" || isFinishedAlbum(album)) &&
      (!genre || album.primaryGenre?.trim().toLowerCase() === genre),
  );
  const newest = (a: T, b: T) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt);
  const share = (album: T) => (album.tracks ? album.withLyrics / album.tracks : 0);
  return kept
    .map((album, index) => ({ album, index }))
    .sort((a, b) => {
      let order = 0;
      if (view.sort === "written") {
        order = b.album.withLyrics - a.album.withLyrics || share(b.album) - share(a.album);
      } else if (view.sort === "liked") {
        order = b.album.likes - a.album.likes;
      }
      return order || newest(a.album, b.album) || a.index - b.index;
    })
    .map(({ album }) => album);
}

/** The distinct genres to offer, in alphabetical order, one spelling per genre. */
export function genreOptions(values: ReadonlyArray<string | null | undefined>): string[] {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const genre = value?.trim();
    if (!genre) continue;
    const key = genre.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, genre);
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * "12 published albums", "3 finished albums in folk", "2 matches for “tide” · finished only";
 * past one page it says which albums are showing: "42 published albums · 21–40 shown".
 */
export function discoverCountLine(count: number, view: Omit<DiscoverView, "page">, page?: DiscoverPage): string {
  const range = page && page.pageCount > 1 ? ` · ${page.start + 1}–${page.end} shown` : "";
  return `${countPhrase(count, view)}${range}`;
}

function countPhrase(count: number, view: Omit<DiscoverView, "page">): string {
  const searching = view.q.length >= 2;
  const filters = [
    view.show === "finished" ? "finished only" : null,
    view.genre ? `in ${view.genre}` : null,
  ].filter(Boolean);
  if (searching) {
    const base = `${count} ${count === 1 ? "match" : "matches"} for “${view.q}”`;
    return filters.length ? `${base} · ${filters.join(" · ")}` : base;
  }
  const noun = `${view.show === "finished" ? "finished" : "published"} ${count === 1 ? "album" : "albums"}`;
  return `${count} ${noun}${view.genre ? ` in ${view.genre}` : ""}`;
}
