import type { Prisma } from "@prisma/client";

import { AlbumJsonSchema, type AlbumJson } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { ApiError } from "@/server/api-error";
import { chargeCredits, CREDIT_COSTS } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { notifyAlbumOwnerQuietly } from "@/server/notify";
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
    /** The database id of the album being remixed, so the remix can link back to it. */
    sourceAlbumId?: string | null;
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
    // Provenance: which album this remix started from, so the original artist's authorship
    // stays visible on the remix (the release header links "Remix of <title> by <artist>" to
    // the original on Discover while it is published). `album_id` is the original's database
    // id, the one in its Discover address. Plain strings only, so it stays JSON-safe; the
    // album schema passes unknown keys through.
    remixed_from: {
      album_id: opts?.sourceAlbumId || null,
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
 * one transaction. Then the original's owner is told who remixed it. Returns the new album's id.
 */
export async function forkIntoWorkspace(input: {
  source: unknown;
  /** The database id of the album being remixed: recorded in `remixed_from`, and its owner is notified. */
  sourceAlbumId: string;
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
      sourceAlbumId: input.sourceAlbumId,
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
  // After the commit: a failed notification never undoes a remix that was paid for.
  await notifyAlbumOwnerQuietly(getPrisma(), {
    albumId: input.sourceAlbumId,
    actorUserId: input.userId,
    kind: "remix",
  });
  return created.id;
}
