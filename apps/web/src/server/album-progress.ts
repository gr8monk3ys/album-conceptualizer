import { getSpineRows } from "@/server/album-songs";
import { scoreStory, type ScoreStory } from "@/lib/score-story";
import { analyzeAlbumCoherence, type CoherenceVerdict } from "@/server/coherence";
import { getPrisma } from "@/server/db";

/**
 * How far an album has come, for a catalog row: tracks with lyrics written out of all tracks
 * (counted as Home, the spine and the handoff pack count it: a track's lyrics are written once
 * any of its Sections has words of its own, `@/lib/lyrics`), and the Coherence verdict label
 * ("Unfinished", "Solid"), the same one the Overview and the Coherence report show, and the
 * whole score story those pages tell (`@/lib/score-story`).
 */
export type AlbumProgress = {
  tracks: number;
  lyricsWritten: number;
  verdict: CoherenceVerdict["label"];
  /** "3 of 8 tracks written · Unfinished", then "Written tracks 65/100 · Whole album 25/100". */
  story: ScoreStory;
};

export function albumProgress(data: unknown): AlbumProgress {
  const rows = getSpineRows(data);
  const coherence = analyzeAlbumCoherence(data);
  return {
    tracks: rows.length,
    lyricsWritten: rows.filter((row) => row.lyricSections > 0).length,
    verdict: coherence.verdict.label,
    story: scoreStory(coherence),
  };
}

/** Progress for each of these albums in the workspace, keyed by album id, in one query. */
export async function albumProgressById(
  workspaceId: string,
  albumIds: string[],
): Promise<Map<string, AlbumProgress>> {
  if (!albumIds.length) return new Map();
  const albums = await getPrisma().album.findMany({
    where: { workspaceId, id: { in: albumIds } },
    select: { id: true, data: true },
  });
  return new Map(albums.map((album) => [album.id, albumProgress(album.data)]));
}
