import { andList } from "@/lib/and-list";

/**
 * The Coherence report's "By dimension" list names one lever per dimension. While the lyric
 * cap holds most of them, that lever is the same sentence on every row ("Write lyrics on 6
 * more tracks (3 and 5–9) to lift this."). Said once above the list instead, it names the
 * dimensions it holds ("… to lift Arc, Themes, Motifs, and Lyrics."), and those rows keep
 * only their own signal. Levers held by a single dimension stay on their row.
 */
export type LeverItem = { key: string; label: string; lever?: string };

export type SharedLever = {
  /** The sentence said once above the list. */
  sentence: string;
  /** The rows whose lever it replaces. */
  keys: Set<string>;
};

const LIFT_THIS = / to lift this\.$/;

export function sharedLever(items: LeverItem[]): SharedLever | null {
  const byLever = new Map<string, LeverItem[]>();
  for (const item of items) {
    if (!item.lever || !LIFT_THIS.test(item.lever)) continue;
    byLever.set(item.lever, [...(byLever.get(item.lever) ?? []), item]);
  }
  let best: [string, LeverItem[]] | null = null;
  for (const entry of byLever) {
    if (entry[1].length >= 2 && (!best || entry[1].length > best[1].length)) best = entry;
  }
  if (!best) return null;
  const [lever, holders] = best;
  const target =
    holders.length === items.length ? "every dimension" : andList(holders.map((item) => item.label));
  return {
    sentence: lever.replace(LIFT_THIS, ` to lift ${target}.`),
    keys: new Set(holders.map((item) => item.key)),
  };
}
