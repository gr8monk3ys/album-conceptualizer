import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";
import { AlbumJsonSchema } from "@/server/album-json";

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
  const trackCount = album.songs.length;

  const created = await prisma.album.create({
    data: {
      workspaceId: workspace.id,
      title: album.title,
      artist: album.artist ?? null,
      conceptSummary: album.concept_summary ?? null,
      primaryGenre: album.primary_genre ?? null,
      centralThemes: album.central_themes ?? undefined,
      trackCount,
      data: album as Prisma.InputJsonValue,
      songs: {
        create: album.songs.map((song) => ({
          trackNumber: song.track_number,
          title: song.title,
          key: song.key ?? null,
          tempo: song.tempo ?? null,
          narrativeSummary: song.narrative_summary ?? null,
          sections: song.sections?.length
            ? {
                create: song.sections.map((section) => ({
                  sectionType: section.section_type,
                  order: section.order,
                  lyrics: section.lyrics ?? null,
                  chordProgression: section.chord_progression ?? [],
                })),
              }
            : undefined,
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
