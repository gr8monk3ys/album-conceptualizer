import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { RoughDemoSchema, StyleBibleSchema, type AlbumJson } from "@/server/album-json";
import { ApiError } from "@/server/api-error";

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

type Tx = Prisma.TransactionClient;

/**
 * Lock the Album row for the rest of the transaction and return its stored snapshot, or a 404.
 * Every snapshot write takes this lock first, so concurrent writes to one album queue up
 * instead of racing on the Song rows' (albumId, trackNumber) uniqueness.
 */
async function lockAlbum(tx: Tx, albumId: string): Promise<Prisma.JsonValue | null> {
  // SELECT … FOR UPDATE rather than a no-op UPDATE, so a patch that writes nothing leaves the
  // row's updatedAt alone. The table is qualified as in schema.prisma's @@schema.
  const rows = await tx.$queryRaw<Array<{ data: Prisma.JsonValue | null }>>`
    SELECT "data" FROM "album_conceptualizer"."Album" WHERE "id" = ${albumId} FOR UPDATE`;
  if (!rows.length) throw new ApiError(404, "Not found.");
  return rows[0].data;
}

async function replaceSnapshot(
  tx: Tx,
  albumId: string,
  album: AlbumJson,
  extra: Omit<Prisma.AlbumUpdateInput, "songs" | "data">,
) {
  await tx.song.deleteMany({ where: { albumId } });
  await tx.album.update({
    where: { id: albumId },
    data: { ...buildAlbumMutationData(album), ...extra },
    select: { id: true },
  });
}

/** Replace an existing album's snapshot and rebuild its projection. */
export async function writeAlbumSnapshot(
  tx: Tx,
  albumId: string,
  album: AlbumJson,
  extra: Omit<Prisma.AlbumUpdateInput, "songs" | "data"> = {},
) {
  await lockAlbum(tx, albumId);
  await replaceSnapshot(tx, albumId, album, extra);
}

/**
 * Change part of an album's snapshot: lock the album, hand `patch` the snapshot as stored now,
 * and write the `album` it returns (with a fresh `updated_at`); `album: null` writes nothing.
 * `patch` may throw an ApiError to refuse. Resolves to what `patch` returned, with `album` as
 * written, so a route can answer with anything else it worked out under the lock.
 *
 * Use this for every write that changes some fields and keeps the rest, so two saves of
 * different parts of one album can't undo each other.
 */
export async function updateAlbumSnapshot<Result extends { album: AlbumJson | null }>(
  tx: Tx,
  albumId: string,
  patch: (stored: Prisma.JsonValue | null) => Result,
): Promise<Result> {
  const result = patch(await lockAlbum(tx, albumId));
  if (!result.album) return result;
  const album = { ...result.album, updated_at: new Date().toISOString() };
  await replaceSnapshot(tx, albumId, album, {});
  return { ...result, album };
}

/**
 * Fields of the snapshot the Studio loads but never edits: the Sound bible and the rough demos
 * have their own pages and routes. A Studio save keeps the stored values of these, so a Studio
 * tab opened before a Sound bible or demo edit can't put the old ones back.
 */
export function keepFieldsTheStudioDoesNotEdit(stored: unknown, studio: AlbumJson): AlbumJson {
  const current = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const merged: AlbumJson = { ...studio };

  // The stored value wins whenever it is readable; an unreadable one is left to the Studio's copy.
  const styleBible = StyleBibleSchema.safeParse(current.style_bible);
  if (current.style_bible === undefined) delete merged.style_bible;
  else if (styleBible.success) merged.style_bible = styleBible.data;

  const roughDemos = z.array(RoughDemoSchema).safeParse(current.rough_demos);
  if (roughDemos.success) merged.rough_demos = roughDemos.data;

  return merged;
}
