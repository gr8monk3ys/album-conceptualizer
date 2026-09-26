import { andList } from "@/lib/and-list";
import { trackCode, trackCodes } from "@/lib/track-number";

/**
 * What is done, said first: an early album's report and bible open on the work that exists
 * ("Track 01, Last Ferry, is written, with chords of its own and a story note, and carries
 * isolation and tide.") before they list what doesn't. Pure and client-safe; it reads the
 * album spine's rows (`getSpineRows`, server/album-songs.ts) and the album's themes.
 */
export type WrittenRow = {
  trackNumber: number;
  title: string;
  /** Sections with written lyrics (`@/lib/lyrics`). */
  lyricSections: number;
  /** Theme tags, trimmed and lower-cased. */
  themeKeys: string[];
  hasNarrative: boolean;
  /** Chords of the track's own (`@/lib/chords`). */
  writtenHarmony: boolean;
};

/** A title the setup gave ("Track 4") says nothing the number doesn't. */
function ownTitle(row: WrittenRow) {
  const title = row.title.trim();
  return title && !/^track\s*\d+$/i.test(title) ? title : null;
}

/** The album themes these tracks carry, in the album's order and its own spelling. */
function carried(rows: WrittenRow[], albumThemes: readonly string[]) {
  const keys = new Set(rows.flatMap((row) => row.themeKeys));
  return albumThemes.filter((theme) => keys.has(theme.trim().toLowerCase()));
}

/**
 * One sentence on what the written tracks hold, or null when no track is written yet (then
 * there is nothing of the artist's to name, and the page leads with its first step instead).
 */
export function writtenSoFar(rows: readonly WrittenRow[], albumThemes: readonly string[]): string | null {
  const written = rows.filter((row) => row.lyricSections > 0);
  if (!written.length) return null;
  const themes = carried(written, albumThemes);

  if (written.length === 1) {
    const [row] = written;
    const title = ownTitle(row);
    const name = title ? `Track ${trackCode(row.trackNumber)}, ${title},` : `Track ${trackCode(row.trackNumber)}`;
    const extras = [row.writtenHarmony ? "chords of its own" : null, row.hasNarrative ? "a story note" : null].filter(
      (part): part is string => Boolean(part),
    );
    const withExtras = extras.length ? `, with ${andList(extras)}` : "";
    const carries = themes.length ? `${extras.length ? "," : ""} and carries ${andList(themes)}` : "";
    return `${name} is written${withExtras}${carries}.`;
  }

  const numbers = written.map((row) => row.trackNumber);
  const withChords = written.filter((row) => row.writtenHarmony).length;
  const chords =
    withChords === written.length
      ? ", all with chords of their own"
      : withChords === 1
        ? ", one with chords of its own"
        : withChords
          ? `, ${withChords} with chords of their own`
          : "";
  const carries = themes.length ? `; between them they carry ${andList(themes)}` : "";
  return `Tracks ${trackCodes(numbers)} are written${chords}${carries}.`;
}

/**
 * What is done on an album, for the top of an early report: the written tracks when there are
 * any, otherwise what the setup put in place ("The sequence is set: 8 tracks, on isolation,
 * signal, tide, and memory."). Null for an album with no tracks.
 */
export function albumSoFar(rows: readonly WrittenRow[], albumThemes: readonly string[]): string | null {
  const written = writtenSoFar(rows, albumThemes);
  if (written) return written;
  if (!rows.length) return null;
  const tracks = `${rows.length} ${rows.length === 1 ? "track" : "tracks"}`;
  const themes = albumThemes.map((theme) => theme.trim()).filter(Boolean);
  return `The sequence is set: ${tracks}${themes.length ? `, on ${andList(themes)}` : ""}.`;
}
