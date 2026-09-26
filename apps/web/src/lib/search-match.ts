// Workspace search helpers that don't need the database: tag matching over album snapshots
// (themes and motifs live only in the snapshot) and result snippets that keep line breaks.

import { asList } from "@/lib/snapshot-values";

export type TagKind = "theme" | "motif";

/** One theme or motif tag that matches the query, on the album itself or on one of its tracks. */
export type TagMatch = {
  albumId: string;
  albumTitle: string;
  kind: TagKind;
  /** The tag as the artist wrote it. */
  tag: string;
  /** Set for a track's own tag; absent for an album-level theme or motif. */
  track?: { number: number; title: string };
};

function tags(value: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of asList(value)) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out;
}

/**
 * Every album theme, album motif, track theme and track motif containing the query (case
 * insensitive), album-level tags first, then tracks in sequence order.
 */
export function findTagMatches(
  albums: ReadonlyArray<{ id: string; title: string; data: unknown }>,
  query: string,
): TagMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hit = (tag: string) => tag.toLowerCase().includes(needle);
  const matches: TagMatch[] = [];

  for (const album of albums) {
    const data = (album.data && typeof album.data === "object" ? album.data : {}) as Record<string, unknown>;
    for (const tag of tags(data.central_themes).filter(hit)) {
      matches.push({ albumId: album.id, albumTitle: album.title, kind: "theme", tag });
    }
    for (const tag of tags(data.recurring_motifs).filter(hit)) {
      matches.push({ albumId: album.id, albumTitle: album.title, kind: "motif", tag });
    }

    const songs = asList(data.songs)
      .filter((raw): raw is Record<string, unknown> => Boolean(raw) && typeof raw === "object")
      .filter((song) => typeof song.track_number === "number" && typeof song.title === "string")
      .sort((a, b) => (a.track_number as number) - (b.track_number as number));
    for (const song of songs) {
      const track = { number: song.track_number as number, title: song.title as string };
      for (const tag of tags(song.themes).filter(hit)) {
        matches.push({ albumId: album.id, albumTitle: album.title, kind: "theme", tag, track });
      }
      for (const tag of tags(song.motifs).filter(hit)) {
        matches.push({ albumId: album.id, albumTitle: album.title, kind: "motif", tag, track });
      }
    }
  }
  return matches;
}

/**
 * A short excerpt around the first match. Line breaks become " / " so two lyric lines never
 * run together into one ("fades / Inland", not "fades Inland"); other whitespace collapses.
 */
export function searchSnippet(text: string, query: string, maxLength = 140): string {
  const normalized = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" / ");
  if (!normalized) return "";
  const idx = query.trim() ? normalized.toLowerCase().indexOf(query.trim().toLowerCase()) : -1;
  if (idx < 0) {
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}…` : normalized;
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(normalized.length, idx + 100);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";
  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
}
