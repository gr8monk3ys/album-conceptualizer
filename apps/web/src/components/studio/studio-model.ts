import type { AlbumJson } from "@/server/album-json";

// Pure helpers for the Studio: album parsing, section labels, keys and error text. No React.

export type StudioAlbum = AlbumJson;
export type StudioSong = StudioAlbum["songs"][number];
export type StudioSection = StudioSong["sections"][number];

export function newId() {
  // Keep generated ids export-safe even in older browsers and test environments.
  try {
    return crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}

export function clampIndex(value: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, value));
}

export function parseChordProgression(raw: string): string[] {
  return raw
    .split(/[\n,]+/g)
    .flatMap((chunk) => chunk.split(/\s+/g))
    .map((token) => token.trim())
    .filter(Boolean);
}

export function stringifyChordProgression(values: unknown): string {
  if (!Array.isArray(values)) return "";
  return values.filter((v) => typeof v === "string").join(" ");
}

export function chordsOf(section: StudioSection | undefined): string[] {
  if (!section || !Array.isArray(section.chord_progression)) return [];
  return section.chord_progression.map((c) => String(c).trim()).filter(Boolean);
}

/** Scaffold placeholders like "[Verse line 1]" are not writing. */
export { isWrittenLyrics as isWritten } from "@/lib/lyrics";

// ---------------------------------------------------------------- section types and labels

export const SECTION_TYPES = [
  { value: "intro", label: "Intro" },
  { value: "verse", label: "Verse" },
  { value: "pre_chorus", label: "Pre-chorus" },
  { value: "chorus", label: "Chorus" },
  { value: "post_chorus", label: "Post-chorus" },
  { value: "bridge", label: "Bridge" },
  { value: "breakdown", label: "Breakdown" },
  { value: "solo", label: "Solo" },
  { value: "interlude", label: "Interlude" },
  { value: "outro", label: "Outro" },
  { value: "tag", label: "Tag" },
  { value: "other", label: "Other" },
] as const;

const TYPE_LABELS = new Map<string, string>(SECTION_TYPES.map((t) => [t.value, t.label]));

/** "pre_chorus" → "Pre-chorus"; unknown values are shown as themselves, capitalised. */
export function sectionTypeLabel(type: string | null | undefined) {
  const raw = (type ?? "").trim();
  if (!raw) return "Section";
  const known = TYPE_LABELS.get(raw.toLowerCase());
  if (known) return known;
  const spaced = raw.replace(/[_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * One notation everywhere: the type plus its count within the song ("Verse 1", "Chorus 2").
 * The same label is used in the section list, the editor heading, comments and previews.
 */
export function sectionLabels(sections: StudioSection[]): string[] {
  const counts = new Map<string, number>();
  return sections.map((section) => {
    const key = (section.section_type ?? "").trim().toLowerCase() || "section";
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return `${sectionTypeLabel(section.section_type)} ${next}`;
  });
}

// ---------------------------------------------------------------- keys and tempo

const MAJOR_KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

export const KEY_OPTIONS = [
  ...MAJOR_KEYS.map((k) => `${k} major`),
  ...MINOR_KEYS.map((k) => `${k} minor`),
];

export const TEMPO_MIN = 20;
export const TEMPO_MAX = 300;

export function clampTempo(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 120;
  return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(value)));
}

// ---------------------------------------------------------------- builders

export function buildNewSection(order: number): StudioSection {
  return { id: newId(), section_type: "verse", order, lyrics: "", chord_progression: [], notes: "" };
}

export function buildNewSong(trackNumber: number): StudioSong {
  return {
    id: newId(),
    title: `Track ${trackNumber}`,
    track_number: trackNumber,
    key: null,
    tempo: null,
    narrative_position: null,
    narrative_summary: null,
    themes: [],
    motifs: [],
    characters: [],
    genre_tags: [],
    mood_tags: [],
    reference_tracks: [],
    instrumentation: [],
    sections: [buildNewSection(0)],
  };
}

export function normalizeOrders<T extends { order: number }>(sections: T[]): T[] {
  return sections.map((section, index) => ({ ...section, order: index }));
}

export function normalizeTrackNumbers<T extends { track_number: number }>(songs: T[]): T[] {
  return songs.map((song, index) => ({ ...song, track_number: index + 1 }));
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** The album JSON as the Studio edits it: stable ids, sorted tracks and sections, lists present. */
export function parseInitialAlbum(initialAlbum: unknown): { album: StudioAlbum; idsWereMissing: boolean } {
  const now = new Date().toISOString();
  const fallback: StudioAlbum = {
    id: newId(),
    title: "Untitled",
    artist: null,
    concept_summary: null,
    primary_genre: null,
    secondary_genres: [],
    era_influence: null,
    release_year: null,
    central_themes: [],
    recurring_motifs: [],
    reference_albums: [],
    visual_inspiration: [],
    rough_demos: [],
    songs: [],
    created_at: now,
    updated_at: now,
  };

  if (!initialAlbum || typeof initialAlbum !== "object") return { album: fallback, idsWereMissing: false };

  const obj = initialAlbum as Partial<StudioAlbum>;
  const rawSongs = Array.isArray(obj.songs) ? obj.songs : [];
  let idsWereMissing = false;

  const songs = rawSongs
    .map((song, songIndex) => {
      const sectionsRaw = Array.isArray(song?.sections) ? song.sections : [];
      const songId = typeof song?.id === "string" && song.id.trim() ? song.id : newId();
      const sections = normalizeOrders(
        sectionsRaw
          .map((section, sectionIndex) => {
            let sectionId = section?.id;
            if (typeof sectionId !== "string" || !sectionId.trim()) {
              idsWereMissing = true;
              sectionId = newId();
            }
            return {
              ...section,
              id: sectionId,
              section_type: section?.section_type || "verse",
              order: typeof section?.order === "number" ? section.order : sectionIndex,
              chord_progression: Array.isArray(section?.chord_progression) ? section.chord_progression : [],
            };
          })
          .sort((a, b) => a.order - b.order),
      );
      return {
        ...song,
        id: songId,
        track_number: typeof song?.track_number === "number" ? song.track_number : songIndex + 1,
        themes: list(song?.themes),
        motifs: list(song?.motifs),
        characters: list(song?.characters),
        genre_tags: list(song?.genre_tags),
        mood_tags: list(song?.mood_tags),
        reference_tracks: list(song?.reference_tracks),
        instrumentation: list(song?.instrumentation),
        sections,
      };
    })
    .sort((a, b) => a.track_number - b.track_number);

  return {
    idsWereMissing,
    album: {
      ...fallback,
      ...obj,
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id : newId(),
      songs: normalizeTrackNumbers(songs),
      central_themes: list(obj.central_themes),
      secondary_genres: list(obj.secondary_genres),
      recurring_motifs: list(obj.recurring_motifs),
      reference_albums: list(obj.reference_albums),
      visual_inspiration: list(obj.visual_inspiration),
      rough_demos: Array.isArray(obj.rough_demos) ? obj.rough_demos : [],
    },
  };
}

/** The first track that would fail to save because it has no title, as a plain sentence. */
export function albumProblem(album: StudioAlbum): string | null {
  if (!album.title?.trim()) return "Give the album a title before saving.";
  const untitled = album.songs.find((song) => !song.title?.trim());
  if (untitled) return `Give track ${untitled.track_number} a title before saving.`;
  return null;
}

// ---------------------------------------------------------------- errors

/**
 * The server's human-written `error` field from `{ error, details? }`, or the fallback.
 * Never a raw body or a bare status code.
 */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  if (response.status === 401) return "You're signed out. Sign in again in another tab, then retry.";
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {
    // Not JSON: fall through to the plain fallback.
  }
  return fallback;
}
