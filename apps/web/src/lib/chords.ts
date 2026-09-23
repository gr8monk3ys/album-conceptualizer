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
  { key: "C", chords: ["C", "G", "Am", "F"] },
  { key: "A minor", chords: ["Am", "F", "C", "G"] },
  { key: "G", chords: ["G", "D", "Em", "C"] },
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

/** True when a section's chords are empty or still exactly one of the starter loops. */
export function isStarterOrEmptyProgression(chords: unknown): boolean {
  const key = progressionKey(chords);
  return !key || STARTER_KEYS.has(key);
}

/** A section's chords count as written once they are set and differ from every starter loop. */
export function isWrittenProgression(chords: unknown): boolean {
  return !isStarterOrEmptyProgression(chords);
}

/** A track has written harmony once any of its sections does. */
export function trackHasWrittenHarmony(sections: unknown): boolean {
  const list = Array.isArray(sections) ? sections : [];
  return list.some((s) => isWrittenProgression((s as { chord_progression?: unknown } | null)?.chord_progression));
}
