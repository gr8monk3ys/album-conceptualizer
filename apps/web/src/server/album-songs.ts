import { isWrittenLyrics } from "@/lib/lyrics";

export type AlbumSongOption = {
  id: string | null;
  trackNumber: number;
  title: string;
};

export function getAlbumSongOptions(data: unknown): AlbumSongOption[] {
  if (!data || typeof data !== "object") return [];
  const songs = (data as { songs?: unknown }).songs;
  if (!Array.isArray(songs)) return [];

  return songs
    .map((song) => {
      if (!song || typeof song !== "object") return null;
      const trackNumber = (song as { track_number?: unknown }).track_number;
      const title = (song as { title?: unknown }).title;
      const idValue = (song as { id?: unknown }).id;
      const id = typeof idValue === "string" && idValue.trim() ? idValue.trim() : null;
      if (typeof trackNumber !== "number" || typeof title !== "string") return null;
      return { id, trackNumber, title };
    })
    .filter((song): song is AlbumSongOption => Boolean(song))
    .sort((left, right) => left.trackNumber - right.trackNumber);
}

export function findAlbumSongByTrackNumber(data: unknown, trackNumber: number) {
  return getAlbumSongOptions(data).find((song) => song.trackNumber === trackNumber) ?? null;
}

export type SpineRow = {
  trackNumber: number;
  title: string;
  sections: number;
  lyricSections: number;
  themes: number;
  hasNarrative: boolean;
};

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}


/** One row per track for the album spine: how far each track has come. */
export function getSpineRows(data: unknown): SpineRow[] {
  const songs = asList((data as { songs?: unknown } | null)?.songs);
  const rows: SpineRow[] = [];
  for (const raw of songs) {
    if (!raw || typeof raw !== "object") continue;
    const song = raw as Record<string, unknown>;
    if (typeof song.track_number !== "number" || typeof song.title !== "string") continue;
    const sections = asList(song.sections);
    rows.push({
      trackNumber: song.track_number,
      title: song.title,
      sections: sections.length,
      lyricSections: sections.filter((s) => isWrittenLyrics((s as { lyrics?: unknown } | null)?.lyrics)).length,
      themes: asList(song.themes).filter((t) => typeof t === "string" && t.trim()).length,
      hasNarrative: typeof song.narrative_summary === "string" && song.narrative_summary.trim().length > 0,
    });
  }
  return rows.sort((a, b) => a.trackNumber - b.trackNumber);
}
