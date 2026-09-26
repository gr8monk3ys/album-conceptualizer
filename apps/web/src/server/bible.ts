import { AlbumJsonSchema } from "@/server/album-json";
import { normalizeStyleBible } from "@/server/style-bible";
import type { AlbumStyleBible } from "@/server/album-json";
import { formatTrackList, type CoherenceFix } from "@/server/coherence";
import { trackHasLyrics } from "@/lib/lyrics";

export type BibleIssue = {
  level: "info" | "warn";
  /**
   * `structure`: how themes, characters and story order hang together across the album, which
   * only the Bible checks. `coverage`: per-track gaps the Coherence report also lists.
   * `style`: Sound bible fields, shown in the Bible's Sound bible section.
   */
  scope: "structure" | "coverage" | "style";
  title: string;
  detail: string;
  /** Where the artist fixes it; build the link with `coherenceFixHref`. */
  fix?: CoherenceFix;
  /**
   * A next step, not a failure: while any track is still unwritten, a theme or character on
   * one track (or none) is work still to come, so it is phrased and marked as "To do" (the
   * Warn For Problems rule). Once every track is written the same thread is a loose one.
   */
  progress?: boolean;
};

export type BibleCoverageRow = {
  label: string;
  trackNumbers: number[];
  // Per-track presence aligned to `timelineTracks`.
  presence: boolean[];
};

export type BibleTrack = {
  id?: string;
  trackNumber: number;
  title: string;
  chronologicalOrder?: number | null;
  narrativeSummary?: string | null;
  themes: string[];
  motifs: string[];
  characters: string[];
  sections: Array<{
    id?: string;
    order: number;
    sectionType: string;
    emotionalArc?: string | null;
    narrativeFunction?: string | null;
    chordCount: number;
  }>;
};

export type AlbumBible = {
  title: string;
  artist: string | null;
  primaryGenre: string | null;
  conceptSummary: string | null;
  styleBible: Required<AlbumStyleBible>;
  centralThemes: string[];
  recurringMotifs: string[];
  tracks: BibleTrack[];
  timeline: {
    mode: "chronological" | "track";
    tracks: BibleTrack[];
  };
  themeGrid: {
    tracks: Array<{ trackNumber: number; title: string }>;
    rows: BibleCoverageRow[];
  };
  characterIndex: Array<{ name: string; trackNumbers: number[] }>;
  motifIndex: Array<{ name: string; trackNumbers: number[] }>;
  issues: BibleIssue[];
};

/** A track number as the spine prints it: "01". */
function padTrack(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

function tracksWord(count: number) {
  return `${count} ${count === 1 ? "track" : "tracks"}`;
}

/**
 * Which tracks carry a theme, as one phrase for a row of the theme map, so a screen reader
 * hears the row once instead of a "yes" or "no" per track: "on tracks 1, 4 and 7".
 */
export function themeTracksPhrase(trackNumbers: number[], totalTracks: number): string {
  const unique = Array.from(new Set(trackNumbers));
  if (!unique.length) return "on no track yet";
  if (unique.length === totalTracks && totalTracks > 2) return `on all ${totalTracks} tracks`;
  return `on ${unique.length === 1 ? "track" : "tracks"} ${formatTrackList(unique)}`;
}


const ARC_LIST = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/**
 * What the spine can't show about a theme: where it enters, where it leaves and where it drops
 * out in between, read along `sequence` (the map's track order, which may be the story order):
 * "first on 02, last on 07, missing from 04–05", "only on 03", "on every track". Empty when no
 * track carries it.
 */
export function themeArc(carrying: number[], sequence: number[]): string {
  const carried = new Set(carrying);
  const positions = sequence.flatMap((trackNumber, index) => (carried.has(trackNumber) ? [index] : []));
  if (!positions.length) return "";
  if (positions.length === 1) return `only on ${padTrack(sequence[positions[0]])}`;
  if (positions.length === sequence.length) return "on every track";
  const first = positions[0];
  const last = positions[positions.length - 1];
  const gaps: string[] = [];
  for (let index = first + 1; index < last; ) {
    if (carried.has(sequence[index])) {
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < last && !carried.has(sequence[end + 1])) end += 1;
    gaps.push(index === end ? padTrack(sequence[index]) : `${padTrack(sequence[index])}–${padTrack(sequence[end])}`);
    index = end + 1;
  }
  const span = `first on ${padTrack(sequence[first])}, last on ${padTrack(sequence[last])}`;
  return gaps.length ? `${span}, missing from ${ARC_LIST.format(gaps)}` : `${span}, unbroken`;
}

/**
 * The Loose threads line. It never claims the album holds together over tracks that aren't
 * written: an empty track has nothing loose because it has nothing yet.
 */
export function looseThreadsSummary(input: { warnings: number; writtenTracks: number; totalTracks: number }): string {
  const { warnings, writtenTracks, totalTracks } = input;
  const unwritten = Math.max(0, totalTracks - writtenTracks);
  const notWritten = unwritten
    ? `${tracksWord(unwritten)} ${unwritten === 1 ? "isn't" : "aren't"} written yet`
    : "";
  if (warnings && unwritten) {
    // Early, a thread that doesn't hold yet is one to pick up in the tracks still to write.
    const threads = warnings === 1 ? "1 thread" : `${warnings} threads`;
    const rest = writtenTracks ? `the other ${tracksWord(unwritten)}` : "the tracks";
    return `${threads} to pick up as you write ${rest}. Each opens where it's done.`;
  }
  if (warnings) {
    const threads = warnings === 1 ? "1 thread doesn't" : `${warnings} threads don't`;
    return `${threads} hold across the album yet. Each links to where it's fixed.`;
  }
  if (!totalTracks) return "Nothing to check until the album has tracks.";
  if (!unwritten) return "Every theme, character and story order holds across the album.";
  if (!writtenTracks) return `Nothing loose so far, but no track is written yet, so there's little to check.`;
  return `Nothing loose on the ${writtenTracks} written ${writtenTracks === 1 ? "track" : "tracks"}; ${notWritten}.`;
}

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeList(value: unknown, limit = 64): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeToken(item))
    .filter(Boolean)
    .slice(0, limit);
}

function normKey(value: string) {
  return value.trim().toLowerCase();
}

function tally(values: string[]) {
  const map = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    const key = normKey(label);
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { label, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function computeIndex(tracks: BibleTrack[], extractor: (track: BibleTrack) => string[]) {
  const map = new Map<string, { name: string; trackNumbers: Set<number> }>();
  for (const track of tracks) {
    for (const token of extractor(track)) {
      const name = token.trim();
      if (!name) continue;
      const key = normKey(name);
      const entry = map.get(key);
      if (entry) entry.trackNumbers.add(track.trackNumber);
      else map.set(key, { name, trackNumbers: new Set([track.trackNumber]) });
    }
  }
  return Array.from(map.values())
    .map((entry) => ({
      name: entry.name,
      trackNumbers: Array.from(entry.trackNumbers).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.trackNumbers.length - a.trackNumbers.length || a.name.localeCompare(b.name));
}

export function buildAlbumBible(data: unknown): AlbumBible {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) {
    return {
      title: "Untitled",
      artist: null,
      primaryGenre: null,
      conceptSummary: null,
      styleBible: normalizeStyleBible(null),
      centralThemes: [],
      recurringMotifs: [],
      tracks: [],
      timeline: { mode: "track", tracks: [] },
      themeGrid: { tracks: [], rows: [] },
      characterIndex: [],
      motifIndex: [],
      issues: [
        {
          level: "warn",
          scope: "structure",
          title: "Album data is invalid",
          detail: "This album's data could not be read. Save the album again in the Studio and try again.",
          fix: { focus: "song" },
        },
      ],
    };
  }

  const album = parsed.data;
  const issues: BibleIssue[] = [];
  // While a track is still unwritten, a theme or character on one track is work to come.
  const early = album.songs.some((song) => !trackHasLyrics(song.sections));
  const styleBible = normalizeStyleBible(album.style_bible);

  const tracks: BibleTrack[] = album.songs
    .slice()
    .sort((a, b) => a.track_number - b.track_number)
    .map((song) => {
      const themes = normalizeList(song.themes);
      const motifs = normalizeList(song.motifs);
      const characters = normalizeList(song.characters);
      const sections = (song.sections ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          id: section.id,
          order: section.order,
          sectionType: section.section_type,
          emotionalArc: normalizeToken(section.emotional_arc) || null,
          narrativeFunction: normalizeToken(section.narrative_function) || null,
          chordCount: Array.isArray(section.chord_progression) ? section.chord_progression.length : 0,
        }));

      return {
        id: song.id,
        trackNumber: song.track_number,
        title: song.title,
        chronologicalOrder: song.chronological_order ?? null,
        narrativeSummary: song.narrative_summary ?? null,
        themes,
        motifs,
        characters,
        sections,
      };
    });

  const centralThemes = normalizeList(album.central_themes);
  const recurringMotifs = normalizeList(album.recurring_motifs);

  const allThemes = tracks.flatMap((track) => track.themes);
  const allMotifs = tracks.flatMap((track) => track.motifs);

  if (!centralThemes.length) {
    const topThemes = tally(allThemes).slice(0, 6).map((row) => row.label);
    issues.push({
      level: "warn",
      scope: "structure",
      title: "No album-level themes set",
      detail: topThemes.length
        ? `Consider promoting key themes: ${topThemes.join(", ")}.`
        : "Add 3 to 6 central themes to keep the tracks pulling in one direction.",
      fix: { focus: "album" },
    });
  }

  if (!recurringMotifs.length) {
    const topMotifs = tally(allMotifs).slice(0, 6).map((row) => row.label);
    issues.push({
      level: "info",
      scope: "coverage",
      title: "No recurring motifs set",
      detail: topMotifs.length
        ? `Motifs tagged on tracks: ${topMotifs.join(", ")}. Consider making 1 to 3 of them album motifs.`
        : "Add 1 to 3 recurring motifs to tie the album together: a sound, a symbol or a chord device.",
      fix: { focus: "album-motifs" },
    });
  }

  if (!styleBible.lead_voice) {
    issues.push({
      level: "info",
      scope: "style",
      title: "No lead voice brief set",
      detail: "Define the vocal identity so collaborators and reference packs aim at the same singer perspective.",
      fix: { focus: "style" },
    });
  }

  if (!styleBible.sonic_palette.length) {
    issues.push({
      level: "info",
      scope: "style",
      title: "No sonic palette locked yet",
      detail: "Add 3-6 palette anchors so arrangement and production choices stay consistent across tracks.",
      fix: { focus: "style" },
    });
  }

  if (!styleBible.mix_priorities.length) {
    issues.push({
      level: "info",
      scope: "style",
      title: "Mix priorities are still blank",
      detail: "Call out what should stay forward, wide, or restrained before export or handoff.",
      fix: { focus: "style" },
    });
  }

  for (const track of tracks) {
    if (!track.narrativeSummary) {
      issues.push({
        level: "info",
        scope: "coverage",
        title: `Track ${padTrack(track.trackNumber)} has no story note`,
        detail: "Add a story note of a sentence or two so the arc can be checked across the album.",
        fix: { focus: "story", trackNumber: track.trackNumber },
      });
    }
    if (!track.themes.length) {
      issues.push({
        level: "info",
        scope: "coverage",
        title: `Track ${padTrack(track.trackNumber)} has no themes`,
        detail: "Tag at least one theme so the theme map can show where it sits.",
        fix: { focus: "song-themes", trackNumber: track.trackNumber },
      });
    }
  }

  const themeIndex = computeIndex(tracks, (t) => t.themes);
  const motifIndex = computeIndex(tracks, (t) => t.motifs);
  const characterIndex = computeIndex(tracks, (t) => t.characters);

  const centralSet = new Set(centralThemes.map(normKey));
  for (const theme of centralThemes) {
    const entry = themeIndex.find((row) => normKey(row.name) === normKey(theme));
    const appears = entry?.trackNumbers ?? [];
    if (!appears.length) {
      issues.push(
        early
          ? {
              level: "warn",
              scope: "structure",
              progress: true,
              title: `Tag “${theme}” on the tracks that carry it`,
              detail: "No track carries it yet. Tag it as you write, or drop it from the album's themes.",
              fix: { focus: "album" },
            }
          : {
              level: "warn",
              scope: "structure",
              title: `Theme “${theme}” isn't on any track`,
              detail: "Tag the tracks where it shows up, or remove it from the album's themes.",
              fix: { focus: "album" },
            },
      );
    } else if (appears.length === 1) {
      issues.push(
        early
          ? {
              level: "warn",
              scope: "structure",
              progress: true,
              title: `Bring “${theme}” into another track`,
              detail: `It's on track ${padTrack(appears[0])} so far. Carry it into another track as you write, so it reads as intentional.`,
              fix: { focus: "song-themes", trackNumber: appears[0] },
            }
          : {
              level: "warn",
              scope: "structure",
              title: `Theme “${theme}” only appears on track ${padTrack(appears[0])}`,
              detail: "Weave it into at least one more track so it feels intentional.",
              fix: { focus: "song-themes", trackNumber: appears[0] },
            },
      );
    }
  }

  for (const row of themeIndex.slice(0, 12)) {
    if (!centralSet.has(normKey(row.name)) && row.trackNumbers.length >= 2) {
      issues.push({
        level: "info",
        scope: "structure",
        title: `Theme “${row.name}” recurs across ${row.trackNumbers.length} tracks`,
        detail: "If it's intentional, add it to the album's themes.",
        fix: { focus: "album" },
      });
    }
  }

  for (const character of characterIndex) {
    if (character.trackNumbers.length === 1) {
      issues.push(
        early
          ? {
              level: "warn",
              scope: "structure",
              progress: true,
              title: `Bring “${character.name}” back on another track`,
              detail: `On track ${padTrack(character.trackNumbers[0])} so far. Bring them back as you write, or leave them out, so the thread doesn't dangle.`,
              fix: { focus: "story", trackNumber: character.trackNumbers[0] },
            }
          : {
              level: "warn",
              scope: "structure",
              title: `Character “${character.name}” only appears once`,
              detail: `Tagged only on track ${padTrack(character.trackNumbers[0])}. Bring them back or remove them, so the thread doesn't dangle.`,
              fix: { focus: "story", trackNumber: character.trackNumbers[0] },
            },
      );
    }
  }

  const chronoCount = tracks.filter((t) => typeof t.chronologicalOrder === "number").length;
  const timelineMode: "chronological" | "track" = chronoCount >= 2 ? "chronological" : "track";
  if (chronoCount > 0 && chronoCount < tracks.length) {
    issues.push({
      level: "warn",
      scope: "structure",
      title: "Chronological order is only partially set",
      detail: "Set a story order on every track for a story album, or clear it and rely on the sequence.",
      fix: {
        focus: "story",
        trackNumber: tracks.find((t) => typeof t.chronologicalOrder !== "number")?.trackNumber,
      },
    });
  }

  const timelineTracks =
    timelineMode === "chronological"
      ? tracks
          .slice()
          .sort(
            (a, b) =>
              (a.chronologicalOrder ?? Number.POSITIVE_INFINITY) -
              (b.chronologicalOrder ?? Number.POSITIVE_INFINITY) ||
              a.trackNumber - b.trackNumber,
          )
      : tracks;

  const gridTracks = timelineTracks.map((t) => ({ trackNumber: t.trackNumber, title: t.title }));
  const gridThemeSource = centralThemes.length
    ? centralThemes
    : tally(allThemes)
        .slice(0, 8)
        .map((row) => row.label);

  const gridRows: BibleCoverageRow[] = gridThemeSource.map((theme) => {
    const themeKey = normKey(theme);
    const trackNumbers = timelineTracks
      .filter((track) => track.themes.some((t) => normKey(t) === themeKey))
      .map((track) => track.trackNumber);
    const presence = timelineTracks.map((track) => track.themes.some((t) => normKey(t) === themeKey));
    return { label: theme, trackNumbers, presence };
  });

  return {
    title: album.title,
    artist: album.artist ?? null,
    primaryGenre: album.primary_genre ?? null,
    conceptSummary: album.concept_summary ?? null,
    styleBible,
    centralThemes,
    recurringMotifs,
    tracks,
    timeline: { mode: timelineMode, tracks: timelineTracks },
    themeGrid: { tracks: gridTracks, rows: gridRows },
    characterIndex,
    motifIndex,
    issues,
  };
}
