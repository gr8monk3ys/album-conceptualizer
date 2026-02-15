import type { Prisma } from "@prisma/client";

import type { AlbumJson } from "@/server/album-json";

export function buildAlbumMutationData(album: AlbumJson) {
  const trackCount = album.songs.length;
  const songsCreate = album.songs.map((song) => ({
    trackNumber: song.track_number,
    title: song.title,
    key: song.key ?? null,
    tempo: song.tempo ?? null,
    narrativeSummary: song.narrative_summary ?? null,
    sections: song.sections.length
      ? {
          create: song.sections.map((section) => ({
            sectionType: section.section_type,
            order: section.order,
            lyrics: section.lyrics ?? null,
            chordProgression: section.chord_progression ?? [],
          })),
        }
      : undefined,
  }));

  return {
    title: album.title,
    artist: album.artist ?? null,
    conceptSummary: album.concept_summary ?? null,
    primaryGenre: album.primary_genre ?? null,
    // Store as JSON array (empty array is valid and allows restores to clear prior values).
    centralThemes: album.central_themes,
    trackCount,
    // The full album JSON is the source of truth for exports + future editors.
    data: album as Prisma.InputJsonValue,
    songs: songsCreate.length ? { create: songsCreate } : undefined,
  };
}
