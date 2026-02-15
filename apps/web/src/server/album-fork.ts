import type { AlbumJson } from "@/server/album-json";

function newId() {
  return crypto.randomUUID();
}

export function forkAlbumJson(
  album: AlbumJson,
  opts?: {
    titleSuffix?: string;
  },
): AlbumJson {
  const now = new Date().toISOString();
  const titleSuffix = opts?.titleSuffix ?? "";

  return {
    ...album,
    id: newId(),
    title: `${album.title}${titleSuffix}`.trim().slice(0, 200),
    created_at: now,
    updated_at: now,
    songs: album.songs.map((song) => ({
      ...song,
      id: newId(),
      sections: song.sections.map((section) => ({
        ...section,
        id: newId(),
      })),
    })),
  };
}

