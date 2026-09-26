import { trackHasWrittenHarmony } from "@/lib/chords";
import { trackHasLyrics } from "@/lib/lyrics";
import { getAlbumStyleBible, summarizeStyleBible } from "@/server/style-bible";

/** Sound bible fields set before the Sound bible counts as set. */
export const STYLE_BIBLE_LOCKED_FIELDS = 3;

/** One thing a handoff carries, as it stands, and where it gets fixed. */
export type ReadinessItem = {
  key: "lyrics" | "chords" | "style";
  /** A plain fact: "3 of 7 tracks written", "Starter chords on 7 tracks". */
  label: string;
  done: boolean;
  /** Where it's fixed: the first track that needs it, or the Sound bible. */
  href: string;
};

export type AlbumReadiness = {
  items: ReadinessItem[];
  /** True when nothing is left: every track written, with chords of its own, Sound bible set. */
  ready: boolean;
  writtenTracks: number;
  totalTracks: number;
  /** The one question the Publish flow asks when something isn't done: "Publish with 3 of 7 tracks written?" */
  question: string;
};

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

type Track = { trackNumber: number; written: boolean; ownChords: boolean; anyChords: boolean };

function readTracks(data: unknown): Track[] {
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!Array.isArray(songs)) return [];
  const tracks: Track[] = [];
  for (const raw of songs) {
    if (!raw || typeof raw !== "object") continue;
    const song = raw as { track_number?: unknown; sections?: unknown };
    if (typeof song.track_number !== "number") continue;
    const sections = Array.isArray(song.sections) ? song.sections : [];
    tracks.push({
      trackNumber: song.track_number,
      written: trackHasLyrics(sections),
      ownChords: trackHasWrittenHarmony(sections),
      anyChords: sections.some((section) => {
        const chords = (section as { chord_progression?: unknown } | null)?.chord_progression;
        return Array.isArray(chords) && chords.some((chord) => typeof chord === "string" && chord.trim());
      }),
    });
  }
  return tracks.sort((left, right) => left.trackNumber - right.trackNumber);
}

/**
 * What a handoff or a publish would carry right now: how many tracks are written, whether the
 * chords are the artist's own, how much of the Sound bible is set. It informs; it never blocks.
 * Placeholder lyrics and the starter loop count as not done (`@/lib/lyrics`, `@/lib/chords`).
 */
export function getAlbumReadiness(albumId: string, data: unknown): AlbumReadiness {
  const base = `/app/albums/${albumId}`;
  const studio = `${base}/studio`;
  const tracks = readTracks(data);
  const total = tracks.length;
  const written = tracks.filter((track) => track.written).length;
  const firstUnwritten = tracks.find((track) => !track.written);
  const withoutChords = tracks.filter((track) => !track.ownChords);
  const allStarter = withoutChords.every((track) => track.anyChords);
  const style = summarizeStyleBible(getAlbumStyleBible(data));

  const items: ReadinessItem[] = [
    {
      key: "lyrics",
      label: total ? `${written} of ${plural(total, "track")} written` : "No tracks yet",
      done: total > 0 && written === total,
      href: firstUnwritten ? `${studio}?song=${firstUnwritten.trackNumber}&focus=lyrics` : studio,
    },
    {
      key: "chords",
      label: !withoutChords.length
        ? total
          ? "Chords of their own on every track"
          : "No chords yet"
        : allStarter
          ? `Starter chords on ${plural(withoutChords.length, "track")}`
          : `No chords of their own on ${plural(withoutChords.length, "track")}`,
      done: total > 0 && withoutChords.length === 0,
      href: withoutChords[0] ? `${studio}?song=${withoutChords[0].trackNumber}` : studio,
    },
    {
      key: "style",
      label: `Sound bible ${style.filledCount} of ${style.totalCount} fields`,
      done: style.filledCount >= STYLE_BIBLE_LOCKED_FIELDS,
      href: `${base}/style`,
    },
  ];

  return {
    items,
    ready: items.every((item) => item.done),
    writtenTracks: written,
    totalTracks: total,
    question:
      total > 0 && written < total
        ? `Publish with ${written} of ${plural(total, "track")} written?`
        : "Publish before these are done?",
  };
}
