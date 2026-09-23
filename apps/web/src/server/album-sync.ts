import type { Prisma } from "@prisma/client";

import type { AlbumJson } from "@/server/album-json";

// The album JSON (`Album.data`) is the source of truth. The Album columns and the Song and
// Section rows are a projection of it for listing and search, rebuilt on every write. The
// projection skips duplicate track numbers and duplicate (section type, order) pairs, which
// the JSON may legitimately contain mid-edit but the relational uniqueness rules do not allow.

function projectSongs(album: AlbumJson) {
  const seenTracks = new Set<number>();
  const songs = [];
  for (const song of album.songs) {
    if (seenTracks.has(song.track_number)) continue;
    seenTracks.add(song.track_number);

    const seenSections = new Set<string>();
    const sections = [];
    for (const section of song.sections) {
      const key = `${section.section_type}\u0000${section.order}`;
      if (seenSections.has(key)) continue;
      seenSections.add(key);
      sections.push({
        sectionType: section.section_type,
        order: section.order,
        lyrics: section.lyrics ?? null,
        chordProgression: section.chord_progression ?? [],
      });
    }

    songs.push({
      trackNumber: song.track_number,
      title: song.title,
      key: song.key ?? null,
      tempo: song.tempo ?? null,
      narrativeSummary: song.narrative_summary ?? null,
      sections: sections.length ? { create: sections } : undefined,
    });
  }
  return songs;
}

export function buildAlbumMutationData(album: AlbumJson) {
  const songsCreate = projectSongs(album);
  return {
    title: album.title,
    artist: album.artist ?? null,
    conceptSummary: album.concept_summary ?? null,
    primaryGenre: album.primary_genre ?? null,
    // Store as JSON array (empty array is valid and allows restores to clear prior values).
    centralThemes: album.central_themes,
    trackCount: album.songs.length,
    data: album as Prisma.InputJsonValue,
    songs: songsCreate.length ? { create: songsCreate } : undefined,
  };
}

/** Replace an existing album's snapshot and rebuild its projection. */
export async function writeAlbumSnapshot(
  tx: Prisma.TransactionClient,
  albumId: string,
  album: AlbumJson,
  extra: Omit<Prisma.AlbumUpdateInput, "songs" | "data"> = {},
) {
  await tx.song.deleteMany({ where: { albumId } });
  await tx.album.update({
    where: { id: albumId },
    data: { ...buildAlbumMutationData(album), ...extra },
    select: { id: true },
  });
}
