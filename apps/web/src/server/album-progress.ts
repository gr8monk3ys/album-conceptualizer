import { getSpineRows } from "@/server/album-songs";
import { analyzeAlbumCoherence, type CoherenceVerdict } from "@/server/coherence";
import { getPrisma } from "@/server/db";

/**
 * How far an album has come, for a catalog row: tracks with lyrics written out of all tracks
 * (counted as Home, the spine and the handoff pack count it: a track's lyrics are written once
 * any of its Sections has words of its own, `@/lib/lyrics`), and the Coherence verdict label
 * ("Unfinished", "Solid"), the same one the Overview and the Coherence report show.
 */
export type AlbumProgress = {
  tracks: number;
  lyricsWritten: number;
  verdict: CoherenceVerdict["label"];
};

export function albumProgress(data: unknown): AlbumProgress {
  const rows = getSpineRows(data);
  return {
    tracks: rows.length,
    lyricsWritten: rows.filter((row) => row.lyricSections > 0).length,
    verdict: analyzeAlbumCoherence(data).verdict.label,
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
