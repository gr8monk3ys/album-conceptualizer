import { trackHasWrittenHarmony } from "@/lib/chords";
import { lyricProgress } from "@/lib/lyrics";
import { analyzeAlbumCoherence } from "@/server/coherence";

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
  /** Sections with written lyrics (see `@/lib/lyrics`). */
  lyricSections: number;
  themes: number;
  /** The track's theme tags, trimmed and lower-cased, for matching against album themes. */
  themeKeys: string[];
  hasNarrative: boolean;
  /** Chords of the track's own (the starter loop doesn't count; see `@/lib/chords`). */
  writtenHarmony: boolean;
  /** The track's Role in the arc ("Inciting incident"), when set. */
  narrativePosition: string | null;
};

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** One row per track for the album spine: how far each track has come. */
export function getSpineRows(data: unknown): SpineRow[] {
  const songs = asList((data as { songs?: unknown } | null)?.songs);
  const rows: SpineRow[] = [];
  for (const raw of songs) {
    if (!raw || typeof raw !== "object") continue;
    const song = raw as Record<string, unknown>;
    if (typeof song.track_number !== "number" || typeof song.title !== "string") continue;
    const { written, total } = lyricProgress(song.sections);
    const themeKeys = Array.from(
      new Set(asList(song.themes).map((t) => text(t)?.toLowerCase()).filter((t): t is string => Boolean(t))),
    );
    rows.push({
      trackNumber: song.track_number,
      title: song.title,
      sections: total,
      lyricSections: written,
      themes: themeKeys.length,
      themeKeys,
      hasNarrative: Boolean(text(song.narrative_summary)),
      writtenHarmony: trackHasWrittenHarmony(song.sections),
      narrativePosition: text(song.narrative_position),
    });
  }
  return rows.sort((a, b) => a.trackNumber - b.trackNumber);
}

/** The album's central themes as the spine shows them: first six, duplicates dropped. */
export function getSpineThemes(data: unknown, limit = 6): string[] {
  const seen = new Set<string>();
  const themes: string[] = [];
  for (const raw of asList((data as { central_themes?: unknown } | null)?.central_themes)) {
    const theme = text(raw);
    if (!theme || seen.has(theme.toLowerCase())) continue;
    seen.add(theme.toLowerCase());
    themes.push(theme);
    if (themes.length === limit) break;
  }
  return themes;
}

export type AlbumNextStep = {
  /** What the album needs, as a sentence: "Track 3 needs lyrics". */
  statement: string;
  /** The button label: "Write track 3". */
  action: string;
  href: string;
  trackNumber?: number;
  /** The track's title when it says more than "Track 3" (scaffolded titles are left out). */
  trackTitle?: string;
};

/**
 * The single most useful thing to do next on an album, read from its tracklist and its
 * Coherence report. Home, the release header and the welcome banner all use this, so they
 * always agree on what comes next.
 */
export function nextAlbumStep(albumId: string, data: unknown): AlbumNextStep {
  const base = `/app/albums/${albumId}`;
  const studio = `${base}/studio`;
  const rows = getSpineRows(data);
  if (!rows.length) {
    return {
      statement: "No tracks yet. Sketch the first one to give the record a shape.",
      action: "Add the first track",
      href: studio,
    };
  }

  const forTrack = (row: SpineRow, statement: string, action: string, focus?: string): AlbumNextStep => ({
    statement,
    action,
    href: `${studio}?song=${row.trackNumber}${focus ? `&focus=${focus}` : ""}`,
    trackNumber: row.trackNumber,
    trackTitle: /^track\s*\d+$/i.test(row.title.trim()) ? undefined : row.title,
  });

  const needsLyrics = rows.find((row) => row.lyricSections === 0);
  // A track left half written ahead of the first empty one comes first: finish it before
  // starting the next ("Finish track 3", straight to its first unwritten section).
  const halfWritten = needsLyrics
    ? rows.find(
        (row) => row.trackNumber < needsLyrics.trackNumber && row.lyricSections > 0 && row.lyricSections < row.sections,
      )
    : undefined;
  if (halfWritten) {
    return forTrack(
      halfWritten,
      `Track ${halfWritten.trackNumber} has ${halfWritten.lyricSections} of ${halfWritten.sections} sections written`,
      `Finish track ${halfWritten.trackNumber}`,
      "lyrics",
    );
  }
  if (needsLyrics) {
    return forTrack(
      needsLyrics,
      `Track ${needsLyrics.trackNumber} needs lyrics`,
      `Write track ${needsLyrics.trackNumber}`,
      "lyrics",
    );
  }
  const needsThemes = rows.find((row) => row.themes === 0);
  if (needsThemes) {
    return forTrack(
      needsThemes,
      `Track ${needsThemes.trackNumber} needs its themes tagged`,
      `Tag track ${needsThemes.trackNumber}`,
      "song-themes",
    );
  }
  const needsStory = rows.find((row) => !row.hasNarrative);
  if (needsStory) {
    return forTrack(
      needsStory,
      `Track ${needsStory.trackNumber} needs a story note`,
      `Add track ${needsStory.trackNumber}'s story note`,
      "story",
    );
  }
  const needsChords = rows.find((row) => !row.writtenHarmony);
  if (needsChords) {
    return forTrack(
      needsChords,
      `Track ${needsChords.trackNumber} still has the starter chords`,
      `Write chords for track ${needsChords.trackNumber}`,
    );
  }

  const report = analyzeAlbumCoherence(data);
  if (report.insufficient || report.score < 70) {
    return {
      statement: report.insufficient
        ? "Every track has a start. The Coherence report says what it still needs."
        : `Every track has lyrics, chords, themes and a story note. The Coherence report scores it ${report.score}/100.`,
      action: "Review coherence",
      href: `${base}/coherence`,
    };
  }
  return {
    statement: `The tracks hold together (${report.score}/100). Take a handoff pack to your DAW or collaborators.`,
    action: "Export handoff pack",
    href: `${base}/export`,
  };
}
