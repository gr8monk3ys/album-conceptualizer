import { invalidChords, isScaffoldSection } from "@/lib/chords";
import { isWrittenLyrics, lyricProgress } from "@/lib/lyrics";
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

/**
 * Every token the artist typed, in order (spaces, commas or bars separate them, as in
 * `parseProgression` from lib/chords). Tokens the exports can't read are kept, not dropped:
 * the field flags them and written harmony doesn't count them.
 */
export function parseChordProgression(raw: string): string[] {
  return raw
    .split(/[\s,|]+/g)
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

// ---------------------------------------------------------------- batch harmony

function typeKey(section: { section_type?: string | null } | undefined) {
  return (section?.section_type ?? "").trim().toLowerCase() || "section";
}

function progressionText(section: StudioSection | undefined) {
  return chordsOf(section).join(" ");
}

/**
 * The other sections of the same type as `index` ("every Verse") whose chords differ from it,
 * when its chords can be reused: set, and all readable by the exports (an unreadable token is
 * never spread across a track). Empty when there's nothing to apply.
 */
export function sameTypeTargets(sections: readonly StudioSection[], index: number): number[] {
  const source = sections[index];
  const chords = chordsOf(source);
  if (!source || !chords.length || invalidChords(chords).length) return [];
  const key = typeKey(source);
  const text = chords.join(" ");
  return sections.flatMap((section, i) =>
    i !== index && typeKey(section) === key && progressionText(section) !== text ? [i] : [],
  );
}

/**
 * The chords half of a section row in the Studio's section list: "starter loop" while the
 * section is still the setup's scaffolding (lib/chords decides, track-aware), "no chords",
 * or the count of chords the exports can read, naming any they can't ("3 chords · 1 unreadable").
 */
export function sectionChordSummary(sections: readonly StudioSection[], index: number): string {
  const chords = chordsOf(sections[index]);
  if (!chords.length) return "no chords";
  const unreadable = invalidChords(chords).length;
  if (!unreadable && isScaffoldSection(sections, index)) return "starter loop";
  const readable = chords.length - unreadable;
  const plural = (n: number) => (n === 1 ? "chord" : "chords");
  if (!readable) return `${unreadable} unreadable ${plural(unreadable)}`;
  const count = `${readable} ${plural(readable)}`;
  return unreadable ? `${count} · ${unreadable} unreadable` : count;
}

/** Whether a section's chords are set and still the starter loop (for the chord field's hint). */
export function isStarterLoopSection(sections: readonly StudioSection[], index: number): boolean {
  return chordsOf(sections[index]).length > 0 && isScaffoldSection(sections, index);
}

/** What a batch change replaced, so Undo can put it back: each changed section's old chords. */
export type ChordSnapshot = { id: string; chords: string[] };

/**
 * Batch harmony: the section at `index`'s chords copied onto every other section of its type
 * on the same track. Returns the new sections, the indices that changed and what they held;
 * null when nothing would change.
 */
export function applyProgressionToType(
  sections: readonly StudioSection[],
  index: number,
): { sections: StudioSection[]; changed: number[]; previous: ChordSnapshot[] } | null {
  const targets = sameTypeTargets(sections, index);
  if (!targets.length) return null;
  const chords = chordsOf(sections[index]);
  const changed = new Set(targets);
  const previous = targets.map((i) => ({ id: sections[i]?.id ?? "", chords: chordsOf(sections[i]) }));
  return {
    sections: sections.map((section, i) => (changed.has(i) ? { ...section, chord_progression: [...chords] } : section)),
    changed: targets,
    previous,
  };
}

/** Undo for `applyProgressionToType`: each snapshotted section gets its old chords back. */
export function restoreProgressions(sections: readonly StudioSection[], previous: readonly ChordSnapshot[]): StudioSection[] {
  const byId = new Map(previous.filter((p) => p.id).map((p) => [p.id, p.chords]));
  return sections.map((section) => {
    const chords = section.id ? byId.get(section.id) : undefined;
    return chords ? { ...section, chord_progression: [...chords] } : section;
  });
}

const AND_LIST = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/** Names a batch change: "Set Verse 2 and Verse 3 to C G Am F." */
export function batchChordsSummary(changedLabels: readonly string[], chords: readonly string[]): string {
  return `Set ${AND_LIST.format(changedLabels)} to ${chords.join(" ")}.`;
}

// ---------------------------------------------------------------- keys and tempo

const MAJOR_KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

export const KEY_OPTIONS = [
  ...MAJOR_KEYS.map((k) => `${k} major`),
  ...MINOR_KEYS.map((k) => `${k} minor`),
];

// "C", "Am", "a min", "E♭ Major" → "C major", "A minor", "A minor", "Eb major".
const KEY_SHORTHAND = /^([A-G])\s*([#♯b♭]?)\s*(major|maj|minor|min|m)?$/i;

/**
 * One spelling for a key, the one the Key select offers ("C major", "A minor"). The setup and
 * older albums write shorthand ("C", "Am"); read as-is, the select would show a stray option
 * and the catalog line would disagree with it. Values that aren't a plain major or minor key
 * ("D dorian") are kept as written.
 */
export function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const match = KEY_SHORTHAND.exec(raw);
  if (!match) return raw;
  const [, letter = "", accidental = "", quality = ""] = match;
  const sign = accidental === "♯" ? "#" : accidental === "♭" || accidental === "B" ? "b" : accidental;
  // "M" alone is the major shorthand; "m", "min" and "minor" (any case) are minor.
  const minor = quality !== "M" && (quality.toLowerCase() === "m" || quality.toLowerCase().startsWith("min"));
  return `${letter.toUpperCase()}${sign} ${minor ? "minor" : "major"}`;
}

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

// ---------------------------------------------------------------- sequencing

/** A copy of `list` with the item at `from` moved to `to`, or null when either is out of range. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] | null {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return null;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** The tracklist with one track moved a step up (-1) or down (1), renumbered 1…n. */
export function moveTrack<T extends { track_number: number }>(songs: readonly T[], index: number, dir: -1 | 1): T[] | null {
  const moved = moveItem(songs, index, index + dir);
  return moved ? normalizeTrackNumbers(moved) : null;
}

/** A track's themes with `theme` added, or removed when it is already there (any casing). */
export function toggleTheme(themes: readonly string[] | null | undefined, theme: string): string[] {
  const list = (themes ?? []).filter((t) => typeof t === "string");
  const key = theme.trim().toLowerCase();
  if (!key) return [...list];
  const has = list.some((t) => t.trim().toLowerCase() === key);
  return has ? list.filter((t) => t.trim().toLowerCase() !== key) : [...list, theme.trim()];
}

/** The album themes a track carries, in the album's order. */
export function carriedThemes(songThemes: readonly string[] | null | undefined, albumThemes: readonly string[]): string[] {
  const carried = new Set((songThemes ?? []).map((t) => t.trim().toLowerCase()));
  return albumThemes.filter((t) => carried.has(t.trim().toLowerCase()));
}

/**
 * Chords anywhere on the album that the exports can't read: how many tokens, and the first
 * section that has one (album order), so the save status can say "Saved · 2 chords won't
 * export" and take the artist to the field.
 */
export function unreadableChordsOnAlbum(
  songs: readonly { sections?: readonly { chord_progression?: unknown }[] | null }[],
): { count: number; first: { song: number; section: number } | null } {
  let count = 0;
  let first: { song: number; section: number } | null = null;
  songs.forEach((song, songIndex) => {
    (song.sections ?? []).forEach((section, sectionIndex) => {
      const bad = invalidChords(section?.chord_progression).length;
      if (!bad) return;
      count += bad;
      first ??= { song: songIndex, section: sectionIndex };
    });
  });
  return { count, first };
}

/** "1 chord won’t export", "3 chords won’t export" (the save status adds "Saved · "). */
export function unreadableChordsStatus(count: number): string {
  return `${count} ${count === 1 ? "chord" : "chords"} won’t export`;
}

/** Index of the first section whose lyrics aren't written yet, or -1 when all are. */
export function firstUnwrittenSection(sections: readonly { lyrics?: unknown }[] | null | undefined): number {
  return (sections ?? []).findIndex((section) => !isWrittenLyrics(section?.lyrics));
}

/**
 * The section "Write next" goes to: the first section still waiting for lyrics, read in order,
 * never the current one. The current track comes first (its first unwritten section, even one
 * before the current section, such as an empty Chorus 1 while Verse 2 is being written), then
 * the album from its first track. Placeholder lyrics ("[Verse line 1]") count as unwritten
 * (`isWrittenLyrics`). Null when every other section is written.
 */
export function nextToWrite(
  songs: readonly { sections?: readonly { lyrics?: unknown }[] | null }[],
  songIndex: number,
  sectionIndex: number,
): { song: number; section: number } | null {
  const isCurrent = (song: number, section: number) => song === songIndex && section === sectionIndex;
  const firstIn = (song: number) => {
    const found = (songs[song]?.sections ?? []).findIndex(
      (section, i) => !isCurrent(song, i) && !isWrittenLyrics(section?.lyrics),
    );
    return found >= 0 ? { song, section: found } : null;
  };
  const here = songIndex >= 0 && songIndex < songs.length ? firstIn(songIndex) : null;
  if (here) return here;
  for (let song = 0; song < songs.length; song += 1) {
    if (song === songIndex) continue;
    const found = firstIn(song);
    if (found) return found;
  }
  return null;
}

/**
 * What the album's shared frame shows (the release header's title, artist and track count,
 * and the spine's titles, lyric progress, themes and roles). When a save changes it, the
 * frame is refreshed so every tab agrees with the Studio.
 */
export function albumFrameKey(album: StudioAlbum): string {
  return JSON.stringify([
    album.title,
    album.artist ?? null,
    (album.central_themes ?? []).map((t) => t.trim().toLowerCase()),
    album.songs.map((song) => {
      const { written, total } = lyricProgress(song.sections);
      return [
        song.id,
        song.track_number,
        song.title,
        written,
        total,
        (song.themes ?? []).map((t) => t.trim().toLowerCase()).sort(),
        Boolean(song.narrative_summary?.trim()),
        song.narrative_position?.trim() ?? "",
      ];
    }),
  ]);
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
        key: normalizeKey(song?.key),
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

// ---------------------------------------------------------------- save status

export type SaveMode = "auto" | "manual" | "version";

/**
 * What the save bar says, split in two: `live` goes in the one status region and changes
 * only for events (a save the artist asked for, its result, a failure); `quiet` is shown
 * beside it and never announced: autosave's "Saving…", "Unsaved changes", and the ticking
 * "Saved · 3 minutes ago". At most one of them holds text.
 */
export function saveStatusParts(state: {
  saving: boolean;
  mode: SaveMode;
  error: string | null;
  flash: string | null;
  dirty: boolean;
  lastSavedAt: string | null;
}): { live: string; quiet: "saving" | "unsaved" | "saved-at" | "no-changes" | null } {
  if (state.saving) return state.mode === "auto" ? { live: "", quiet: "saving" } : { live: "Saving…", quiet: null };
  if (state.error) return { live: `Couldn't save — ${state.error}`, quiet: null };
  if (state.flash) return { live: state.flash, quiet: null };
  if (state.dirty) return { live: "", quiet: "unsaved" };
  return { live: "", quiet: state.lastSavedAt ? "saved-at" : "no-changes" };
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
