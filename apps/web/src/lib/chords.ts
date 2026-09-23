// What counts as written harmony, defined once, like lib/lyrics does for words. The guided
// setup gives every section one of these loops so each track can be previewed right away;
// until the artist changes it, the loop is scaffolding, not a harmonic decision, and nothing
// (the coherence report, the setup checklist, the spine) may count it as written.
//
// The trade-off: an artist who deliberately keeps a starter loop (C G Am F is also the most
// common pop progression) sees "still the starting loop" until they change one chord. That
// wording stays true either way, which a "written" tick on untouched scaffolding would not.

/** The loops the setup writes, one per starting key. */
export const STARTER_PROGRESSIONS: ReadonlyArray<{ key: string; chords: readonly string[] }> = [
  { key: "C major", chords: ["C", "G", "Am", "F"] },
  { key: "A minor", chords: ["Am", "F", "C", "G"] },
  { key: "G major", chords: ["G", "D", "Em", "C"] },
  { key: "D minor", chords: ["Dm", "Bb", "F", "C"] },
];

function progressionKey(chords: unknown): string {
  if (!Array.isArray(chords)) return "";
  return chords
    .filter((chord): chord is string => typeof chord === "string")
    .map((chord) => chord.trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

const STARTER_KEYS = new Set(STARTER_PROGRESSIONS.map((p) => progressionKey(p.chords)));

// Chord symbols the engine's exports understand (models/music_theory.py Chord.from_symbol):
// a root A–G with an optional # or b; a quality (m, maj, dim, aug, sus2/sus4, add9, 5, m7b5 …);
// optional extensions (6, 7, 9, 11, 13, with b/# alterations, add9, sus4); and an optional slash
// bass. ASCII only, as the engine reads it. Anything else would reach MIDI and MusicXML as a
// wrong chord, so it is flagged where it's typed and never counts as written.
const CHORD_SYMBOL =
  /^[A-G][#b]?(?:m7b5|maj13|maj11|maj9|maj7|maj|dim7|dim|aug|min|m|sus2|sus4|sus|add9|add11|add13|5)?(?:(?:[b#]?(?:5|6|7|9|11|13))|add(?:9|11|13)|sus[24]?)*(?:\/[A-G][#b]?)?$/;

/** Whether one token is a chord symbol the exports can read, e.g. "Am7", "F#m7b5", "G/B". */
export function isChordSymbol(token: string): boolean {
  return CHORD_SYMBOL.test(token.trim());
}

/**
 * Split typed chords into tokens (spaces, commas or bars separate them) and sort them into the
 * ones the exports can read and the ones they can't, keeping order.
 */
export function parseProgression(text: string): { chords: string[]; invalid: string[] } {
  const tokens = text
    .split(/[\s,|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const chords: string[] = [];
  const invalid: string[] = [];
  for (const token of tokens) (isChordSymbol(token) ? chords : invalid).push(token);
  return { chords, invalid };
}

function chordList(chords: unknown): string[] {
  if (!Array.isArray(chords)) return [];
  return chords.filter((chord): chord is string => typeof chord === "string" && chord.trim().length > 0);
}

/** The tokens in a stored progression that the exports can't read. */
export function invalidChords(chords: unknown): string[] {
  return chordList(chords).filter((chord) => !isChordSymbol(chord));
}

/** True when a section's chords are empty or still exactly one of the starter loops. */
export function isStarterOrEmptyProgression(chords: unknown): boolean {
  const key = progressionKey(chords);
  return !key || STARTER_KEYS.has(key);
}

/**
 * A section's chords count as written once they are set, differ from every starter loop, and
 * are all chord symbols the exports can read.
 */
export function isWrittenProgression(chords: unknown): boolean {
  return !isStarterOrEmptyProgression(chords) && invalidChords(chords).length === 0;
}

/** A track has written harmony once any of its sections does. */
export function trackHasWrittenHarmony(sections: unknown): boolean {
  const list = Array.isArray(sections) ? sections : [];
  return list.some((s) => isWrittenProgression((s as { chord_progression?: unknown } | null)?.chord_progression));
}
