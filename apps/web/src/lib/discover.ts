// What a published album shows on Discover before anyone spends credits on it: how much is
// written and a few lines of each track's lyrics. Read leniently from the album
// snapshot; "written" always means what @/lib/lyrics says it means.

import { isWrittenLyrics } from "@/lib/lyrics";

type Raw = Record<string, unknown>;

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function songsOf(data: unknown): Raw[] {
  return asList((data as { songs?: unknown } | null)?.songs)
    .filter((raw): raw is Raw => Boolean(raw) && typeof raw === "object")
    .filter((song) => typeof song.track_number === "number" && typeof song.title === "string");
}

/**
 * "7 tracks · lyrics on 5": the track count and how many tracks have any written lyrics (count
 * those with `getSpineRows`, whose `lyricSections` follows @/lib/lyrics).
 */
export function writtenSummaryLine({ tracks, withLyrics }: { tracks: number; withLyrics: number }) {
  const count = `${tracks} ${tracks === 1 ? "track" : "tracks"}`;
  if (!tracks) return count;
  if (!withLyrics) return `${count} · no lyrics yet`;
  if (withLyrics === tracks) return `${count} · lyrics on all`;
  return `${count} · lyrics on ${withLyrics}`;
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
