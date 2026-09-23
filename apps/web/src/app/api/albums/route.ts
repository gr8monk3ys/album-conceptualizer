import { NextResponse } from "next/server";
import { z } from "zod";

import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, enforceRateLimit, parseJsonBody, requireWorkspace } from "@/server/api";
import { chargeCredits, CREDIT_COSTS } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { enforceProjectLimit } from "@/server/plan";
import { wizardReferenceRows } from "@/server/wizard-references";

export const runtime = "nodejs";

const BodySchema = z.object({
  album: AlbumJsonSchema,
});

export const POST = apiHandler(async (request: Request) => {
  const { userId, workspaceId, plan } = await requireWorkspace();
  await enforceRateLimit(
    "albums_create",
    `user:${userId}`,
    "Too many new albums in a short time. Wait a minute and try again.",
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
        "Not enough credits to create a new album. Complete a challenge or upgrade your plan.",
    });
    await enforceProjectLimit(tx, workspaceId, plan);
    const createdAlbum = await tx.album.create({
      data: { workspaceId, ...buildAlbumMutationData(album) },
      select: { id: true },
    });
    // The records named in the wizard join the album's References collection, whole-album
    // scoped, so the References page and the Overview count show them from the start.
    const references = wizardReferenceRows(createdAlbum.id, album.reference_albums);
    if (references.length) {
      await tx.albumReference.createMany({ data: references });
    }
    return createdAlbum;
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
