import { z } from "zod";

import { REFERENCE_BPM_MAX, REFERENCE_BPM_MIN, REFERENCE_BPM_RULE } from "@/lib/reference-bpm";
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
  bpm: z.number().int().min(REFERENCE_BPM_MIN).max(REFERENCE_BPM_MAX).optional(),
  key: z.string().trim().max(64).optional(),
  moodTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  arrangementTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  songTrackNumber: z.number().int().min(1).max(MAX_ALBUM_SONGS).optional(),
});

export type ReferenceBody = z.infer<typeof ReferenceBodySchema>;

/** Each field's rule in the words the References form uses, for a 400 that names the field. */
const REFERENCE_FIELD_RULES: Record<keyof ReferenceBody, string> = {
  title: "Reference title is required, up to 200 characters.",
  artist: "Artist can be up to 200 characters.",
  sourceUrl: "Source URL should be the full link, starting with https://, up to 500 characters.",
  notes: "“Why this reference matters” can be up to 2,000 characters.",
  targetRole: "Target role should be one of the roles in the list.",
  bpm: REFERENCE_BPM_RULE,
  key: "Key can be up to 64 characters.",
  moodTags: "Mood tags: up to 12, each up to 40 characters.",
  arrangementTags: "Arrangement tags: up to 12, each up to 40 characters.",
  songTrackNumber: "Song target should be one of the album's tracks.",
};

const UNREADABLE_BODY = "The reference couldn't be read. Reload the page and try again.";

/**
 * A reference body, or a 400 whose message names the field and its rule ("BPM is a whole
 * number from 20 to 300."), with every broken field's rule in `details`.
 */
export function parseReferenceBody(value: unknown): ReferenceBody {
  const parsed = ReferenceBodySchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const rules = Array.from(
    new Set(
      parsed.error.issues.map((issue) => {
        const field = issue.path[0];
        return typeof field === "string" && field in REFERENCE_FIELD_RULES
          ? REFERENCE_FIELD_RULES[field as keyof ReferenceBody]
          : UNREADABLE_BODY;
      }),
    ),
  );
  throw new ApiError(400, rules[0] ?? UNREADABLE_BODY, undefined, rules.slice(0, 5));
}

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
