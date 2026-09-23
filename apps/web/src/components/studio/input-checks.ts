import { parseProgression } from "@/lib/chords";
import { TEMPO_MAX, TEMPO_MIN } from "@/components/studio/studio-model";

// Checks for the Studio's musical input, run where it's typed. Pure; no React.

/** Chords to suggest when a token isn't one the exports can read. */
export const CHORD_EXAMPLES = "Am, F#m7, G/B";

function unique(tokens: readonly string[]): string[] {
  return Array.from(new Set(tokens));
}

/** "a" · "a and b" · "a, b and c" · "a, b, c and 2 more". */
export function joinWords(items: readonly string[]): string {
  const list = unique(items);
  if (list.length <= 1) return list[0] ?? "";
  if (list.length <= 3) return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return `${list.slice(0, 3).join(", ")} and ${list.length - 3} more`;
}

/** “a” · “a” and “b” · “a”, “b” and “c” · “a”, “b”, “c” and 2 more. */
export function quoteTokens(tokens: readonly string[]): string {
  return joinWords(unique(tokens).map((token) => `“${token}”`));
}

/**
 * The typed tokens the exports can't read, once each, in the order typed. While the artist is
 * still typing the last token (`typing`, and no separator after it yet) it isn't flagged if it
 * starts like a chord, so "Cad" on the way to "Cadd9" doesn't flash an error; "banana" is
 * flagged at once, and everything is flagged when the field loses focus.
 */
export function unreadableChords(text: string, { typing = false }: { typing?: boolean } = {}): string[] {
  const { invalid } = parseProgression(text);
  let flagged = invalid;
  if (typing && invalid.length && !/[\s,|]$/.test(text)) {
    const tokens = text.split(/[\s,|]+/).filter(Boolean);
    const last = tokens[tokens.length - 1];
    if (last && last === invalid[invalid.length - 1] && /^[A-G]/.test(last)) flagged = invalid.slice(0, -1);
  }
  return unique(flagged);
}

/** "“banana” isn't a chord the exports can read — try Am, F#m7, G/B." Null when all read. */
export function chordProblem(tokens: readonly string[]): string | null {
  const list = unique(tokens);
  if (!list.length) return null;
  const verb = list.length === 1 ? "isn't a chord" : "aren't chords";
  return `${quoteTokens(list)} ${verb} the exports can read — try ${CHORD_EXAMPLES}.`;
}

/** Why a preview can't start while chords are unreadable, and where to fix them. */
export function previewBlockedMessage(tokens: readonly string[], sections: readonly string[] = []): string {
  const list = unique(tokens);
  const verb = list.length === 1 ? "isn't a chord" : "aren't chords";
  const pronoun = list.length === 1 ? "it" : "them";
  const where = sections.length ? joinWords(sections) : "Chord progression";
  return `${quoteTokens(list)} ${verb} the exports can read, so this can't be previewed yet. Fix ${pronoun} in ${where}.`;
}

export type TempoReading = {
  /** The tempo to store: in range, or null when the field is empty or unreadable. */
  tempo: number | null;
  /** Set when the typed value was outside the range and `tempo` is the nearest limit. */
  clamped: "high" | "low" | null;
  /** The field holds something that isn't a number. */
  unreadable: boolean;
};

/** Reads the tempo field: rounds, and clamps to TEMPO_MIN…TEMPO_MAX, saying so. */
export function readTempo(raw: string): TempoReading {
  const text = raw.trim();
  if (!text) return { tempo: null, clamped: null, unreadable: false };
  const value = Number(text);
  if (!Number.isFinite(value)) return { tempo: null, clamped: null, unreadable: true };
  const rounded = Math.round(value);
  if (rounded > TEMPO_MAX) return { tempo: TEMPO_MAX, clamped: "high", unreadable: false };
  if (rounded < TEMPO_MIN) return { tempo: TEMPO_MIN, clamped: "low", unreadable: false };
  return { tempo: rounded, clamped: null, unreadable: false };
}

/** Shown in coral while the typed tempo is out of range. */
export function tempoLimitMessage(clamped: "high" | "low"): string {
  return clamped === "high" ? `Tempo is capped at ${TEMPO_MAX} bpm.` : `Tempo can't go below ${TEMPO_MIN} bpm.`;
}

/** Shown once the field has been set to the limit, so the change is stated, not silent. */
export function tempoClampedNote(clamped: "high" | "low"): string {
  const limit = clamped === "high" ? TEMPO_MAX : TEMPO_MIN;
  return `${tempoLimitMessage(clamped).slice(0, -1)}, so this track is set to ${limit}.`;
}
