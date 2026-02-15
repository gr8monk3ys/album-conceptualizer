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
  { params }: { params: Promise<{ token: string }> },
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

  const { token } = await params;
  const prisma = getPrisma();
  const share = await prisma.albumShareLink.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      album: { select: { data: true } },
    },
  });
  if (!share?.album?.data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (share.revokedAt) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const now = new Date();
  if (share.expiresAt && share.expiresAt.getTime() < now.getTime()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = AlbumJsonSchema.safeParse(share.album.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Shared album payload is invalid." }, { status: 400 });
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

  const forked = forkAlbumJson(parsed.data, { titleSuffix: " (Remix)" });
  const mutation = buildAlbumMutationData(forked);

  try {
    await spendCredits({
      workspaceId: workspace.id,
      plan,
      amount: 5,
      reason: "album_create_remix",
      metadata: { source: "share", token },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits to fork a remix. Complete challenges or upgrade." },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : "Unable to spend credits.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

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
        message: "Forked from share link",
        data: forked as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return album;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
