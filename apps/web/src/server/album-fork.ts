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
  const forked = forkAlbumJson(parsed.data, { titleSuffix: " (Remix)" });

  const created = await getPrisma().$transaction(async (tx) => {
    await chargeCredits(tx, {
      workspaceId: input.workspaceId,
      plan: input.plan,
      amount: CREDIT_COSTS.albumFork,
      reason: "album_create_remix",
      metadata: input.creditMetadata,
      insufficientMessage: "Not enough credits to remix. Complete challenges or upgrade.",
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
