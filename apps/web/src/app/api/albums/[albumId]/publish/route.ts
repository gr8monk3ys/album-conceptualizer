import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const BodySchema = z.object({
  isPublic: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const now = new Date();
  const updated = await prisma.album.update({
    where: { id: existing.id },
    data: {
      isPublic: payload.data.isPublic,
      publishedAt: payload.data.isPublic ? now : null,
    },
    select: { isPublic: true, publishedAt: true },
  });

  return NextResponse.json(updated);
}

