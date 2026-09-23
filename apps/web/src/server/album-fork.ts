import type { Prisma } from "@prisma/client";

import { AlbumJsonSchema, type AlbumJson } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { ApiError } from "@/server/api-error";
import { chargeCredits, CREDIT_COSTS } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { enforceProjectLimit, type Plan } from "@/server/plan";

function newId() {
  return crypto.randomUUID();
}

export function forkAlbumJson(
  album: AlbumJson,
  opts?: {
    titleSuffix?: string;
    /**
     * Who is making the remix. Their copy is credited to them (or to no one, when their name
     * isn't known); the original artist is kept in `remixed_from`, never in `artist`.
     */
    remixerName?: string | null;
  },
): AlbumJson {
  const now = new Date().toISOString();
  const titleSuffix = opts?.titleSuffix ?? "";
  const remixer = opts?.remixerName?.trim().slice(0, 200) || null;

  return {
    ...album,
    id: newId(),
    title: `${album.title}${titleSuffix}`.trim().slice(0, 200),
    artist: remixer,
    // Provenance: which album this remix started from. Plain strings only, so it stays
    // JSON-safe; the album schema passes unknown keys through.
    remixed_from: {
      title: album.title,
      artist: typeof album.artist === "string" && album.artist.trim() ? album.artist.trim() : null,
    },
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

/**
 * Fork a published or shared album snapshot into the caller's workspace: charge the fork,
 * enforce the free plan's project limit, and create the album with a first version, all in
 * one transaction. Returns the new album's id.
 */
export async function forkIntoWorkspace(input: {
  source: unknown;
  workspaceId: string;
  plan: Plan;
  userId: string;
  versionMessage: string;
  creditMetadata: Prisma.InputJsonValue;
}): Promise<string> {
  const parsed = AlbumJsonSchema.safeParse(input.source);
  if (!parsed.success) throw new ApiError(422, "This album can't be remixed because its data is invalid.");

  const created = await getPrisma().$transaction(async (tx) => {
    const remixer = await tx.user.findUnique({
      where: { id: input.userId },
      select: { name: true },
    });
    const forked = forkAlbumJson(parsed.data, {
      titleSuffix: " (Remix)",
      remixerName: remixer?.name ?? null,
    });
    await chargeCredits(tx, {
      workspaceId: input.workspaceId,
      plan: input.plan,
      amount: CREDIT_COSTS.albumFork,
      reason: "album_create_remix",
      metadata: input.creditMetadata,
      insufficientMessage: "Not enough credits to remix. Complete a challenge or upgrade your plan.",
    });
    await enforceProjectLimit(tx, input.workspaceId, input.plan);
    const album = await tx.album.create({
      data: { workspaceId: input.workspaceId, ...buildAlbumMutationData(forked) },
      select: { id: true },
    });
    await tx.albumVersion.create({
      data: {
        albumId: album.id,
        createdByUserId: input.userId,
        message: input.versionMessage,
        data: forked as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return album;
  });
  return created.id;
}
