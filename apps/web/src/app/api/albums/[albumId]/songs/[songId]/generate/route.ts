/**
 * POST /api/albums/[albumId]/songs/[songId]/generate
 *
 * Triggers AI generation for a single song via the Python/CrewAI backend.
 * This runs the "song development crew" which coordinates the Lyricist,
 * Music Theorist, Style Matcher, and Narrative agents to produce:
 *   - Complete lyrics for all sections
 *   - Chord progressions with harmonic analysis
 *   - Production notes
 *   - Narrative validation
 *
 * Expected Python backend endpoint:
 *   POST /albums/{album_id}/songs/{song_id}/generate
 *
 * Request body (forwarded to Python):
 *   {
 *     narrativePosition?: string;   — where this song sits in the album arc
 *     themes?: string[];            — thematic focus for this track
 *     emotionalArc?: string;        — desired emotional trajectory
 *     mood?: string;                — mood/atmosphere
 *     songStructure?: string;       — section structure (e.g., "Verse-Chorus-Verse-Chorus-Bridge-Chorus")
 *   }
 */
import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { proxyToAIJson, proxyToAIStream } from "@/server/ai-proxy";

export const runtime = "nodejs";

// Allow long-running generation requests up to 5 minutes
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string; songId: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Workspace / album / song ownership ─────────────────────────────
  const { albumId, songId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const song = await prisma.song.findFirst({
    where: {
      id: songId,
      album: { id: albumId, workspaceId: workspace.id },
    },
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
  });
  if (!song) {
    return NextResponse.json({ error: "Song not found." }, { status: 404 });
  }

  // ── Parse request body ─────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    // Empty body is fine
  }

  // Enrich payload with song + album context from the database
  const payload = {
    song_title: song.title,
    track_number: song.trackNumber,
    album_title: song.album.title,
    album_artist: song.album.artist,
    album_concept: song.album.conceptSummary,
    primary_genre: song.album.primaryGenre,
    central_themes: song.album.centralThemes,
    key: song.key,
    tempo: song.tempo,
    narrative_position: body.narrativePosition ?? song.narrativeSummary ?? "",
    themes: body.themes ?? song.album.centralThemes ?? [],
    emotional_arc: body.emotionalArc ?? "",
    mood: body.mood ?? "",
    song_structure:
      body.songStructure ??
      "Verse 1 - Chorus - Verse 2 - Chorus - Bridge - Chorus",
    ...body,
  };

  // ── Check if client wants streaming ────────────────────────────────
  const acceptsStream = request.headers
    .get("accept")
    ?.includes("text/event-stream");

  if (acceptsStream) {
    try {
      const upstream = await proxyToAIStream(
        `/albums/${albumId}/songs/${songId}/generate`,
        payload,
      );

      if (!upstream.ok) {
        const errorData = await upstream
          .json()
          .catch(() => ({ detail: "Song generation failed." }));
        return NextResponse.json(
          {
            error:
              (errorData as Record<string, string>).detail ??
              "Song generation failed.",
          },
          { status: upstream.status },
        );
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err) {
      console.error("[generate/song] Streaming proxy error:", err);
      return NextResponse.json(
        { error: "Failed to connect to AI backend." },
        { status: 502 },
      );
    }
  }

  // ── Non-streaming JSON response ────────────────────────────────────
  try {
    const result = await proxyToAIJson(
      `/albums/${albumId}/songs/${songId}/generate`,
      payload,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            (result.data as Record<string, string>)?.detail ??
            "Song generation failed.",
        },
        { status: result.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("[generate/song] Proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to AI backend." },
      { status: 502 },
    );
  }
}
