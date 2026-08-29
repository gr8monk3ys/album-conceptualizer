export type AlbumSongOption = {
  id: string | null;
  trackNumber: number;
  title: string;
};

export function getAlbumSongOptions(data: unknown): AlbumSongOption[] {
  if (!data || typeof data !== "object") return [];
  const songs = (data as { songs?: unknown }).songs;
  if (!Array.isArray(songs)) return [];

  return songs
    .map((song) => {
      if (!song || typeof song !== "object") return null;
      const trackNumber = (song as { track_number?: unknown }).track_number;
      const title = (song as { title?: unknown }).title;
      const idValue = (song as { id?: unknown }).id;
      const id = typeof idValue === "string" && idValue.trim() ? idValue.trim() : null;
      if (typeof trackNumber !== "number" || typeof title !== "string") return null;
      return { id, trackNumber, title };
    })
    .filter((song): song is AlbumSongOption => Boolean(song))
    .sort((left, right) => left.trackNumber - right.trackNumber);
}

export function findAlbumSongByTrackNumber(data: unknown, trackNumber: number) {
  return getAlbumSongOptions(data).find((song) => song.trackNumber === trackNumber) ?? null;
}
