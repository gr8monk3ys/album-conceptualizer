import { andList } from "@/lib/and-list";
import { invalidChords, isScaffoldSection } from "@/lib/chords";
import { isWrittenLyrics, lyricProgress } from "@/lib/lyrics";
import type { AlbumJson } from "@/server/album-json";
import { TEMPO_MAX, TEMPO_MIN } from "@/lib/tempo";

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

/** Names a batch change: "Set Verse 2 and Verse 3 to C G Am F." */
export function batchChordsSummary(changedLabels: readonly string[], chords: readonly string[]): string {
  return `Set ${andList(changedLabels)} to ${chords.join(" ")}.`;
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
    title: defaultTrackTitle(trackNumber),
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

/** The name a track gets until the artist writes one: "Track 5" (the setup writes it too). */
export function defaultTrackTitle(trackNumber: number) {
  return `Track ${trackNumber}`;
}

/**
 * The tracklist renumbered 1…n after a delete, a move, an add or an Undo, keeping each number
 * and its name in agreement: a track still called by its old default name ("Track 2", trimmed,
 * exact case, matching its number before the change) takes the default for its new place
 * ("Track 1"), so "01" is never "Track 2". Titles the artist wrote are never touched.
 */
export function renumberTracks<T extends { track_number: number; title?: string | null }>(songs: readonly T[]): T[] {
  return songs.map((song, index) => renumberTrack(song, index + 1));
}

/** One track at `number`: its default name follows the number; a written title stays. */
function renumberTrack<T extends { track_number: number; title?: string | null }>(song: T, number: number): T {
  if (song.track_number === number) return song;
  const keepsDefault = typeof song.title === "string" && song.title.trim() === defaultTrackTitle(song.track_number);
  return keepsDefault
    ? { ...song, track_number: number, title: defaultTrackTitle(number) }
    : { ...song, track_number: number };
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

/**
 * The tracklist with the track at `from` moved to `to` in one step (any distance), renumbered
 * 1…n; default names follow their new numbers (`renumberTracks`), so "01" is never "Track 2".
 * Null when either place is out of range or they are the same.
 */
export function moveTrackTo<T extends { track_number: number; title?: string | null }>(
  songs: readonly T[],
  from: number,
  to: number,
): T[] | null {
  const moved = moveItem(songs, from, to);
  return moved ? renumberTracks(moved) : null;
}

/** A title a move changed (a default name following its number): what it was, what it became. */
export type TrackRename = { id: string; before: string; after: string };

type SequencedTrack = { id?: string | null; track_number: number; title?: string | null };

/** The titles that differ between two orders of the same tracks, matched by id. */
export function trackRenames(before: readonly SequencedTrack[], after: readonly SequencedTrack[]): TrackRename[] {
  const was = new Map(before.flatMap((song) => (song.id ? [[song.id, song.title ?? ""] as const] : [])));
  return after.flatMap((song) => {
    const old = song.id ? was.get(song.id) : undefined;
    const now = song.title ?? "";
    return song.id && old !== undefined && old !== now ? [{ id: song.id, before: old, after: now }] : [];
  });
}

/**
 * Two moves' renames as one (several moves of a track share one Undo): each track keeps the
 * name it had before the first move and the one it has after the last; a name that is back
 * where it started drops out.
 */
export function mergeRenames(first: readonly TrackRename[], second: readonly TrackRename[]): TrackRename[] {
  const merged = new Map(first.map((rename) => [rename.id, { ...rename }]));
  for (const rename of second) {
    const earlier = merged.get(rename.id);
    merged.set(rename.id, earlier ? { ...earlier, after: rename.after } : { ...rename });
  }
  return [...merged.values()].filter((rename) => rename.before !== rename.after);
}

/**
 * Undo for a move: the track `songId` back at `from`, renumbered, and every name the move
 * changed put back exactly as it was ("Track 3" is "Track 1" again), unless the artist has
 * renamed it since, in which case their title stays and only the usual renumbering applies.
 * Null when the track is gone.
 */
export function undoTrackMove<T extends SequencedTrack>(
  songs: readonly T[],
  songId: string,
  from: number,
  renamed: readonly TrackRename[],
): T[] | null {
  const at = songs.findIndex((song) => song.id === songId);
  if (at < 0) return null;
  const back = moveItem(songs, at, clampIndex(from, songs.length)) ?? [...songs];
  const names = new Map(renamed.map((rename) => [rename.id, rename]));
  return back.map((song, index) => {
    const rename = song.id ? names.get(song.id) : undefined;
    if (rename && (song.title ?? "") === rename.after) return { ...song, track_number: index + 1, title: rename.before };
    return renumberTrack(song, index + 1);
  });
}

/**
 * What the Undo line says about a move, from where the track started to where it is now:
 * "Moved “Signal” from 01 to 05.", naming the track as the writer knew it and, when a default
 * name followed its number, what it is called now: "Moved “Track 1” (now “Track 2”) from 01 to 02."
 */
export function moveUndoLabel(fromTitle: string, nowTitle: string, from: number, to: number): string {
  const before = fromTitle.trim() || "Untitled";
  const after = nowTitle.trim() || "Untitled";
  const name = before === after ? `“${before}”` : `“${before}” (now “${after}”)`;
  const pad = (n: number) => String(n + 1).padStart(2, "0");
  return `Moved ${name} from ${pad(from)} to ${pad(to)}.`;
}

/**
 * What moving a section says: "Moved Chorus 1 to section 1 of 2." A section is named by its
 * label, bare like every name the app gives (titles, the artist's words, are the ones in
 * quotes); when the move changes the label ("Verse 2" above "Verse 1" becomes "Verse 1"), the
 * new one follows: "Moved Verse 2 to section 1 of 3, now Verse 1."
 */
export function sectionMoveAnnouncement(before: string, after: string, to: number, total: number): string {
  const place = `section ${to + 1} of ${total}`;
  return before === after ? `Moved ${before} to ${place}.` : `Moved ${before} to ${place}, now ${after}.`;
}

/** The save bar's line beside a section move's Undo: "Moved Chorus 1 from section 2 to 1." */
export function sectionMoveUndoLabel(before: string, after: string, from: number, to: number): string {
  const name = before === after ? before : `${before} (now ${after})`;
  return `Moved ${name} from section ${from + 1} to ${to + 1}.`;
}

/**
 * What a move says to a screen reader, from the place it left to the place it took: "Moved
 * “Signal” to track 5 of 10." A default name follows its number, so quoting it as a title read
 * oddly ("Moved “Track 3” (now “Track 2”) to track 2"): such a track is named by its place, and
 * its new name follows: "Moved track 3 to track 2 of 10, now called “Track 2”."
 */
export function moveAnnouncement(fromTitle: string, nowTitle: string, from: number, to: number, count: number): string {
  const before = fromTitle.trim() || "Untitled";
  const after = nowTitle.trim() || "Untitled";
  const place = `track ${to + 1} of ${count}`;
  return before === after
    ? `Moved “${before}” to ${place}.`
    : `Moved track ${from + 1} to ${place}, now called “${after}”.`;
}

/**
 * The other tracks with the same title as the track at `index` (trimmed, any casing), by
 * track number. Empty titles match nothing.
 */
export function tracksSharingTitle(
  songs: readonly { track_number: number; title?: string | null }[],
  index: number,
): number[] {
  const key = (songs[index]?.title ?? "").trim().toLocaleLowerCase();
  if (!key) return [];
  return songs.flatMap((song, i) =>
    i !== index && (song.title ?? "").trim().toLocaleLowerCase() === key ? [song.track_number] : [],
  );
}

/** "Track 03 is also called this.", "Tracks 03 and 07 are also called this." Empty for none. */
export function sharedTitleHint(trackNumbers: readonly number[]): string {
  if (!trackNumbers.length) return "";
  const numbers = trackNumbers.map((n) => String(n).padStart(2, "0"));
  return numbers.length === 1
    ? `Track ${numbers[0]} is also called this.`
    : `Tracks ${andList(numbers)} are also called this.`;
}

/** The tracklist without the track at `index`, renumbered, default names following. */
export function removeTrack<T extends { track_number: number; title?: string | null }>(songs: readonly T[], index: number): T[] {
  return renumberTracks(songs.filter((_, i) => i !== index));
}

/**
 * Undo for `removeTrack`: `song` (as it was when deleted, number and name) back at `index`,
 * and every other default name back to its number again.
 */
export function restoreTrack<T extends { track_number: number; title?: string | null }>(
  songs: readonly T[],
  song: T,
  index: number,
): T[] {
  const next = [...songs];
  next.splice(Math.min(Math.max(0, index), next.length), 0, song);
  return renumberTracks(next);
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
/**
 * Unreadable-chord counts per progression array. Typing lyrics replaces a section's object but
 * keeps its chord array, so the album-wide count below re-reads only the chords that changed.
 */
const unreadableCounts = new WeakMap<object, number>();

function unreadableCount(progression: unknown): number {
  if (!progression || typeof progression !== "object") return invalidChords(progression).length;
  let count = unreadableCounts.get(progression);
  if (count === undefined) {
    count = invalidChords(progression).length;
    unreadableCounts.set(progression, count);
  }
  return count;
}

export function unreadableChordsOnAlbum(
  songs: readonly { sections?: readonly { chord_progression?: unknown }[] | null }[],
): { count: number; first: { song: number; section: number } | null } {
  let count = 0;
  let first: { song: number; section: number } | null = null;
  songs.forEach((song, songIndex) => {
    (song.sections ?? []).forEach((section, sectionIndex) => {
      const bad = unreadableCount(section?.chord_progression);
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

/**
 * The Studio's document title, naming the track on screen: "Studio · Harbour Wall · Salt Year
 * · Album Conceptualizer" (the page's own title, "Studio · Salt Year", in the root layout's
 * "%s · Album Conceptualizer" template, with the track put in).
 */
export function studioDocumentTitle(
  song: { title?: string | null; track_number: number } | undefined,
  albumTitle: string | null | undefined,
): string {
  const track = song ? song.title?.trim() || `Track ${song.track_number}` : null;
  return ["Studio", track, albumTitle?.trim() || "Untitled album", "Album Conceptualizer"].filter(Boolean).join(" · ");
}

/** Where the problem `albumProblem` names is fixed: the album's title, or track `index`'s. */
export function albumProblemField(
  album: StudioAlbum,
): { field: "album-title" } | { field: "track-title"; index: number } | null {
  if (!album.title?.trim()) return { field: "album-title" };
  const index = album.songs.findIndex((song) => !song.title?.trim());
  return index >= 0 ? { field: "track-title", index } : null;
}

/** The first track that would fail to save because it has no title, as a plain sentence. */
export function albumProblem(album: StudioAlbum): string | null {
  const at = albumProblemField(album);
  if (!at) return null;
  if (at.field === "album-title") return "Give the album a title before saving.";
  return `Give track ${album.songs[at.index]?.track_number} a title before saving.`;
}

// ---------------------------------------------------------------- save status

export type SaveMode = "auto" | "manual" | "version";

/** The confirmation of a named snapshot, naming it: "Saved “First pass” as a version." */
export function versionSavedText(note: string | null | undefined): string {
  const name = note?.trim();
  return name ? `Saved “${name}” as a version.` : "Saved as a version.";
}

/**
 * What the save bar says, split in two: `live` goes in the one status region and changes
 * only for results (a save the artist asked for, once it is done, and a failure); `quiet` is
 * shown beside it and never announced: "Saving…" (autosave's and a Save now's alike, so an
 * asked-for save is said once, as "Saved.", never "Saving…" first), "Unsaved changes", and
 * the ticking "Saved · 3 minutes ago". At most one of them holds text.
 */
export function saveStatusParts(state: {
  saving: boolean;
  error: string | null;
  flash: string | null;
  dirty: boolean;
  lastSavedAt: string | null;
}): { live: string; quiet: "saving" | "unsaved" | "saved-at" | "no-changes" | null } {
  if (state.saving) return { live: "", quiet: "saving" };
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
