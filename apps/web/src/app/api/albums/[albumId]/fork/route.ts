import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { AlbumJsonSchema } from "@/server/album-json";
import { forkAlbumJson } from "@/server/album-fork";
import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { buildAlbumMutationData } from "@/server/album-sync";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { InsufficientCreditsError, spendCredits } from "@/server/credits";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rate = await checkRateLimit("albums_create", `user:${userId}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many project creations. Please wait a bit and try again." },
      { status: 429, headers: getRateLimitHeaders(rate) },
    );
  }

  const { albumId } = await params;
  const prisma = getPrisma();

  const source = await prisma.album.findFirst({
    where: { id: albumId, isPublic: true },
    select: { id: true, data: true },
  });
  if (!source?.data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = AlbumJsonSchema.safeParse(source.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Published album payload is invalid." }, { status: 400 });
  }

  const workspace = await getActiveWorkspaceForUser(userId);

  // Plan gating (keep behavior aligned with /api/albums).
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

  try {
    await spendCredits({
      workspaceId: workspace.id,
      plan,
      amount: 5,
      reason: "album_create_remix",
      metadata: { source: "discover", albumId: source.id },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits to remix. Complete challenges or upgrade." },
        { status: 402 },
      );
    }
    console.error("Failed to spend credits for album fork:", err);
    const message = err instanceof Error ? err.message : "Unable to spend credits.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const forked = forkAlbumJson(parsed.data, { titleSuffix: " (Remix)" });
  const mutation = buildAlbumMutationData(forked);

  const created = await prisma.$transaction(async (tx) => {
    const album = await tx.album.create({
      data: {
        workspaceId: workspace.id,
        ...mutation,
      },
      select: { id: true },
    });

    await tx.albumVersion.create({
      data: {
        albumId: album.id,
        createdByUserId: userId,
        message: "Forked from Discover",
        data: forked as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return album;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

