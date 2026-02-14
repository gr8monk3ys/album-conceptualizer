import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrisma } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";
import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";

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
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many project creations. Please wait a bit and try again." },
      { status: 429, headers: getRateLimitHeaders(rate) },
    );
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

  const created = await prisma.album.create({
    data: {
      workspaceId: workspace.id,
      ...mutation,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
