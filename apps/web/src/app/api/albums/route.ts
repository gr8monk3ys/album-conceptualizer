import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrisma } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit, getRateLimitFailure } from "@/server/rate-limit";
import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { InsufficientCreditsError, spendCredits } from "@/server/credits";
import { trackProductEventSafe } from "@/server/analytics";

export const runtime = "nodejs";

const BodySchema = z.object({
  album: AlbumJsonSchema,
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rate = await checkRateLimit("albums_create", `user:${userId}`);
  const rateFailure = getRateLimitFailure(
    rate,
    "Too many project creations. Please wait a bit and try again.",
  );
  if (rateFailure) {
    return NextResponse.json(rateFailure.body, {
      status: rateFailure.status,
      headers: rateFailure.headers,
    });
  }

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid album payload." }, { status: 400 });
  }

  const prisma = getPrisma();
  const workspace = await getActiveWorkspaceForUser(userId);

  // Simple plan gating (placeholder; real usage should be credit-based).
  const plan = workspace.subscription?.plan ?? "free";
  if (plan === "free") {
    const existing = await prisma.album.count({ where: { workspaceId: workspace.id } });
    if (existing >= 5) {
      return NextResponse.json(
        { error: "Free plan is limited to 5 projects. Upgrade to create more." },
        { status: 402 },
      );
    }
  }

  const album = payload.data.album;
  const mutation = buildAlbumMutationData(album);

  try {
    // Credit spend (keeps the model aligned with Suno-style usage accounting).
    await spendCredits({
      workspaceId: workspace.id,
      plan,
      amount: 5,
      reason: "album_create",
      metadata: { title: album.title },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits to create a new project. Complete challenges or upgrade." },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : "Unable to spend credits.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const created = await prisma.album.create({
    data: {
      workspaceId: workspace.id,
      ...mutation,
    },
    select: { id: true },
  });

  await trackProductEventSafe({
    name: "album_created",
    workspaceId: workspace.id,
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
}
