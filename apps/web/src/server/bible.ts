import { AlbumJsonSchema } from "@/server/album-json";
import { normalizeStyleBible } from "@/server/style-bible";
import type { AlbumStyleBible } from "@/server/album-json";

export type BibleIssue = {
  level: "info" | "warn";
  title: string;
  detail: string;
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
          title: "Album data is invalid",
          detail: "This project data could not be parsed. Re-save the project from Studio and try again.",
        },
      ],
    };
  }

  const album = parsed.data;
  const issues: BibleIssue[] = [];
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
      title: "No album-level themes set",
      detail: topThemes.length
        ? `Consider promoting key themes: ${topThemes.join(", ")}.`
        : "Add 3-6 central themes to guide consistency across tracks.",
    });
  }

  if (!recurringMotifs.length) {
    const topMotifs = tally(allMotifs).slice(0, 6).map((row) => row.label);
    issues.push({
      level: "info",
      title: "No recurring motifs set",
      detail: topMotifs.length
        ? `Motifs detected in tracks: ${topMotifs.join(", ")}. Consider elevating 1-3 to album-level motifs.`
        : "Add 1-3 recurring motifs to tighten cohesion (sonic texture, symbols, chord devices).",
    });
  }

  if (!styleBible.lead_voice) {
    issues.push({
      level: "info",
      title: "No lead voice brief set",
      detail: "Define the vocal identity so collaborators and reference packs aim at the same singer perspective.",
    });
  }

  if (!styleBible.sonic_palette.length) {
    issues.push({
      level: "info",
      title: "No sonic palette locked yet",
      detail: "Add 3-6 palette anchors so arrangement and production choices stay consistent across tracks.",
    });
  }

  if (!styleBible.mix_priorities.length) {
    issues.push({
      level: "info",
      title: "Mix priorities are still blank",
      detail: "Call out what should stay forward, wide, or restrained before export or handoff.",
    });
  }

  for (const track of tracks) {
    if (!track.narrativeSummary) {
      issues.push({
        level: "info",
        title: `Track ${track.trackNumber} is missing a narrative summary`,
        detail: "Add a 1-2 sentence summary so the arc can be validated across the album.",
      });
    }
    if (!track.themes.length) {
      issues.push({
        level: "info",
        title: `Track ${track.trackNumber} has no themes`,
        detail: "Add at least 1 theme tag so coverage checks can detect gaps.",
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
      issues.push({
        level: "warn",
        title: `Theme "${theme}" never appears in track tags`,
        detail: "Either remove it from album-level themes or tag the tracks where it should show up.",
      });
    } else if (appears.length === 1) {
      issues.push({
        level: "warn",
        title: `Theme "${theme}" only appears in Track ${appears[0]}`,
        detail: "Consider weaving it into at least one more track to make it feel intentional.",
      });
    }
  }

  for (const row of themeIndex.slice(0, 12)) {
    if (!centralSet.has(normKey(row.name)) && row.trackNumbers.length >= 2) {
      issues.push({
        level: "info",
        title: `Theme "${row.name}" recurs across ${row.trackNumbers.length} tracks`,
        detail: "Consider adding it to album-level themes if it is intentional.",
      });
    }
  }

  for (const character of characterIndex) {
    if (character.trackNumbers.length === 1) {
      issues.push({
        level: "warn",
        title: `Character "${character.name}" only appears once`,
        detail: `Currently only tagged in Track ${character.trackNumbers[0]}. Either bring them back or remove to avoid a dangling thread.`,
      });
    }
  }

  const chronoCount = tracks.filter((t) => typeof t.chronologicalOrder === "number").length;
  const timelineMode: "chronological" | "track" = chronoCount >= 2 ? "chronological" : "track";
  if (chronoCount > 0 && chronoCount < tracks.length) {
    issues.push({
      level: "warn",
      title: "Chronological order is only partially set",
      detail: "Either set chronological_order for every track (for story albums) or rely on track order only.",
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
