import { z } from "zod";

import { MAX_ALBUM_SONGS } from "@/server/album-json";
import { findAlbumSongByTrackNumber } from "@/server/album-songs";
import { ApiError } from "@/server/api-error";
import { getPrisma } from "@/server/db";

export type AlbumReferenceRecord = {
  id: string;
  songId: string | null;
  songTrackNumber: number | null;
  songTitle: string | null;
  title: string;
  artist: string | null;
  sourceUrl: string | null;
  notes: string | null;
  targetRole: string | null;
  bpm: number | null;
  key: string | null;
  moodTags: string[];
  arrangementTags: string[];
  createdAt: string;
  updatedAt: string;
};

/** The body of a create or update: an update replaces every field. */
export const ReferenceBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).optional(),
  sourceUrl: z.url().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  targetRole: z
    .enum([
      "album-world",
      "opener",
      "closer",
      "chorus-energy",
      "vocal-texture",
      "mix-palette",
      "bridge-contrast",
    ])
    .optional(),
  bpm: z.number().int().min(40).max(280).optional(),
  key: z.string().trim().max(64).optional(),
  moodTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  arrangementTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  songTrackNumber: z.number().int().min(1).max(MAX_ALBUM_SONGS).optional(),
});

export type ReferenceBody = z.infer<typeof ReferenceBodySchema>;

/** Trimmed, lowercased and deduplicated tags. */
export function normalizeTags(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.toLowerCase()),
    ),
  );
}

/**
 * The stored fields for a reference body, with its song target resolved against the album
 * JSON. Throws a 400 when the body targets a song the album does not have.
 */
export function buildReferenceData(albumData: unknown, body: ReferenceBody) {
  const song = body.songTrackNumber
    ? findAlbumSongByTrackNumber(albumData, body.songTrackNumber)
    : null;
  if (body.songTrackNumber && !song) {
    throw new ApiError(400, "Selected song target was not found.");
  }

  return {
    songId: song?.id ?? null,
    songTrackNumber: song?.trackNumber ?? null,
    songTitle: song?.title ?? null,
    title: body.title,
    artist: body.artist || null,
    sourceUrl: body.sourceUrl || null,
    notes: body.notes || null,
    targetRole: body.targetRole || null,
    bpm: body.bpm ?? null,
    key: body.key || null,
    moodTags: normalizeTags(body.moodTags),
    arrangementTags: normalizeTags(body.arrangementTags),
  };
}

/** The columns an `AlbumReferenceRecord` is built from. */
export const REFERENCE_SELECT = {
  id: true,
  songId: true,
  songTrackNumber: true,
  songTitle: true,
  title: true,
  artist: true,
  sourceUrl: true,
  notes: true,
  targetRole: true,
  bpm: true,
  key: true,
  moodTags: true,
  arrangementTags: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function mapReference(
  reference: {
    id: string;
    songId: string | null;
    songTrackNumber: number | null;
    songTitle: string | null;
    title: string;
    artist: string | null;
    sourceUrl: string | null;
    notes: string | null;
    targetRole: string | null;
    bpm: number | null;
    key: string | null;
    moodTags: string[];
    arrangementTags: string[];
    createdAt: Date;
    updatedAt: Date;
  },
): AlbumReferenceRecord {
  return {
    id: reference.id,
    songId: reference.songId,
    songTrackNumber: reference.songTrackNumber,
    songTitle: reference.songTitle,
    title: reference.title,
    artist: reference.artist,
    sourceUrl: reference.sourceUrl,
    notes: reference.notes,
    targetRole: reference.targetRole,
    bpm: reference.bpm,
    key: reference.key,
    moodTags: reference.moodTags,
    arrangementTags: reference.arrangementTags,
    createdAt: reference.createdAt.toISOString(),
    updatedAt: reference.updatedAt.toISOString(),
  };
}

export async function listAlbumReferences(workspaceId: string, albumId: string) {
  const prisma = getPrisma();
  const references = await prisma.albumReference.findMany({
    where: {
      albumId,
      album: { workspaceId },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: REFERENCE_SELECT,
  });

  return references.map(mapReference);
}
