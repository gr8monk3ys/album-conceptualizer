// What counts as the album's motifs, defined once (like lib/lyrics and lib/chords): the motifs
// named for the whole album (`recurring_motifs`) plus every motif tag on its tracks. The Bible's
// motif index and the Coherence report both read this, so one can never say "no motifs" while
// the other says "the album has motifs".

export type MotifEntry = {
  /** The motif as first written (album-level spelling wins over a track tag's). */
  name: string;
  /** True when the motif is one of the album's own motifs, not only a track tag. */
  albumLevel: boolean;
  /** The tracks tagged with it, in order. Empty for an album motif no track carries yet. */
  trackNumbers: number[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Every motif of an album, merged case-insensitively: album motifs first in the album's own
 * order, then track-only tags; each with the tracks that carry it. Sorted by how many tracks
 * carry it, most first, so the motif doing the most work leads.
 */
export function albumMotifIndex(data: unknown): MotifEntry[] {
  const album = (data ?? {}) as { recurring_motifs?: unknown; songs?: unknown };
  const entries = new Map<string, { name: string; albumLevel: boolean; order: number; tracks: Set<number> }>();
  let order = 0;

  for (const raw of list(album.recurring_motifs)) {
    const name = text(raw);
    const key = name.toLowerCase();
    if (!name || entries.has(key)) continue;
    entries.set(key, { name, albumLevel: true, order: order++, tracks: new Set() });
  }

  for (const song of list(album.songs)) {
    const trackNumber = (song as { track_number?: unknown } | null)?.track_number;
    if (typeof trackNumber !== "number") continue;
    for (const raw of list((song as { motifs?: unknown }).motifs)) {
      const name = text(raw);
      const key = name.toLowerCase();
      if (!name) continue;
      const entry = entries.get(key) ?? { name, albumLevel: false, order: order++, tracks: new Set<number>() };
      entry.tracks.add(trackNumber);
      entries.set(key, entry);
    }
  }

  return Array.from(entries.values())
    .sort((a, b) => b.tracks.size - a.tracks.size || a.order - b.order)
    .map((entry) => ({
      name: entry.name,
      albumLevel: entry.albumLevel,
      trackNumbers: Array.from(entry.tracks).sort((a, b) => a - b),
    }));
}
