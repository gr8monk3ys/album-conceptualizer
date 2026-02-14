import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrisma } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";

const SectionSchema = z.object({
  id: z.string().optional(),
  section_type: z.string().min(1),
  order: z.number().int().min(0),
  lyrics: z.string().optional().nullable(),
  chord_progression: z.array(z.string()).optional(),
});

const SongSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  track_number: z.number().int().min(1),
  key: z.string().optional().nullable(),
  tempo: z.number().int().optional().nullable(),
  narrative_summary: z.string().optional().nullable(),
  sections: z.array(SectionSchema).optional(),
});

const AlbumJsonSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  artist: z.string().optional().nullable(),
  concept_summary: z.string().optional().nullable(),
  primary_genre: z.string().optional().nullable(),
  central_themes: z.array(z.string()).optional(),
  songs: z.array(SongSchema),
});

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
      data: album,
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
