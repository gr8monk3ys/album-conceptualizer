/**
 * POST /api/albums/[albumId]/songs/[songId]/sections/[sectionId]/generate
 *
 * Triggers AI generation for a single section (lyrics, chords, narrative)
 * via the Python/CrewAI backend.  This is a more granular operation than
 * full song generation — it targets one specific section (e.g., "Verse 2")
 * and produces or regenerates its content.
 *
 * Expected Python backend endpoint:
 *   POST /albums/{album_id}/songs/{song_id}/sections/{section_id}/generate
 *
 * Request body (forwarded to Python):
 *   {
 *     generateLyrics?: boolean;     — whether to generate/regenerate lyrics
 *     generateChords?: boolean;     — whether to generate/regenerate chord progression
 *     context?: string;             — additional creative direction
 *     mood?: string;                — desired mood for this section
 *   }
 */
import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { proxyToAIJson } from "@/server/ai-proxy";

export const runtime = "nodejs";

// Allow generation requests up to 3 minutes
export const maxDuration = 180;

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      albumId: string;
      songId: string;
      sectionId: string;
    }>;
  },
) {
  // ── Auth ────────────────────────────────────────────────────────────
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Workspace / album / song / section ownership ───────────────────
  const { albumId, songId, sectionId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      songId,
      song: {
        album: { id: albumId, workspaceId: workspace.id },
      },
    },
    select: {
      id: true,
      sectionType: true,
      order: true,
      lyrics: true,
      chordProgression: true,
      song: {
        select: {
          id: true,
          title: true,
          trackNumber: true,
          key: true,
          tempo: true,
          narrativeSummary: true,
          album: {
            select: {
              title: true,
              artist: true,
              conceptSummary: true,
              primaryGenre: true,
              centralThemes: true,
            },
          },
        },
      },
    },
  });
  if (!section) {
    return NextResponse.json(
      { error: "Section not found." },
      { status: 404 },
    );
  }

  // ── Parse request body ─────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    // Empty body is fine
  }

  // Enrich payload with full context
  const { song } = section;
  const { album } = song;

  const payload = {
    section_type: section.sectionType,
    section_order: section.order,
    existing_lyrics: section.lyrics,
    existing_chords: section.chordProgression,
    song_title: song.title,
    track_number: song.trackNumber,
    song_key: song.key,
    song_tempo: song.tempo,
    narrative_summary: song.narrativeSummary,
    album_title: album.title,
    album_artist: album.artist,
    album_concept: album.conceptSummary,
    primary_genre: album.primaryGenre,
    central_themes: album.centralThemes,
    generate_lyrics: body.generateLyrics ?? true,
    generate_chords: body.generateChords ?? true,
    context: body.context ?? "",
    mood: body.mood ?? "",
    ...body,
  };

  // ── Forward to Python backend ──────────────────────────────────────
  try {
    const result = await proxyToAIJson(
      `/albums/${albumId}/songs/${songId}/sections/${sectionId}/generate`,
      payload,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            (result.data as Record<string, string>)?.detail ??
            "Section generation failed.",
        },
        { status: result.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("[generate/section] Proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to AI backend." },
      { status: 502 },
    );
  }
}
