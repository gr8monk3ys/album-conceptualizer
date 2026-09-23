import { NextResponse } from "next/server";
import { z } from "zod";

import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, enforceRateLimit, parseJsonBody, requireWorkspace } from "@/server/api";
import { chargeCredits, CREDIT_COSTS } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { enforceProjectLimit } from "@/server/plan";

export const runtime = "nodejs";

const BodySchema = z.object({
  album: AlbumJsonSchema,
});

export const POST = apiHandler(async (request: Request) => {
  const { userId, workspaceId, plan } = await requireWorkspace();
  await enforceRateLimit(
    "albums_create",
    `user:${userId}`,
    "Too many project creations. Please wait a bit and try again.",
  );
  const { album } = await parseJsonBody(request, BodySchema, "Invalid album payload.");

  const created = await getPrisma().$transaction(async (tx) => {
    await chargeCredits(tx, {
      workspaceId,
      plan,
      amount: CREDIT_COSTS.albumCreate,
      reason: "album_create",
      metadata: { title: album.title },
      insufficientMessage:
        "Not enough credits to create a new project. Complete challenges or upgrade.",
    });
    await enforceProjectLimit(tx, workspaceId, plan);
    return tx.album.create({
      data: { workspaceId, ...buildAlbumMutationData(album) },
      select: { id: true },
    });
  });

  await trackProductEventSafe({
    name: "album_created",
    workspaceId,
    userId,
    albumId: created.id,
    path: "/api/albums",
    metadata: {
      title: album.title,
      trackCount: album.songs.length,
      narrativeStructure: album.narrative_structure ?? null,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
});
