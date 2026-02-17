/**
 * POST /api/albums/[albumId]/generate
 *
 * Triggers full album generation via the Python/CrewAI backend.
 * This runs the "vision crew" which coordinates the Director, Style Matcher,
 * and Narrative agents to produce a complete album concept including:
 *   - Album vision & concept summary
 *   - Style profile
 *   - Narrative structure with song blueprints
 *
 * Expected Python backend endpoint:
 *   POST /albums/{album_id}/generate
 *
 * Request body (forwarded to Python):
 *   {
 *     concept?: string;       — album concept/premise
 *     references?: string;    — reference artists/albums
 *     audience?: string;      — target audience
 *     constraints?: string;   — creative constraints
 *     trackCount?: number;    — desired number of tracks
 *   }
 *
 * The Python backend may return a streaming response for long-running
 * generation.  This route supports both streaming and non-streaming modes.
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
  { params }: { params: Promise<{ albumId: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Workspace / album ownership ────────────────────────────────────
  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: {
      id: true,
      title: true,
      artist: true,
      conceptSummary: true,
      primaryGenre: true,
      centralThemes: true,
    },
  });
  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  // ── Parse request body ─────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    // Empty body is fine — the Python backend can use album defaults
  }

  // Enrich the payload with album context from the database
  const payload = {
    concept: body.concept ?? album.conceptSummary ?? album.title,
    references: body.references ?? "",
    audience: body.audience ?? "",
    constraints: body.constraints ?? "",
    track_count: body.trackCount ?? 10,
    // Pass database album info so the Python backend has full context
    album_title: album.title,
    album_artist: album.artist,
    primary_genre: album.primaryGenre,
    central_themes: album.centralThemes,
    ...body,
  };

  // ── Check if client wants streaming ────────────────────────────────
  const acceptsStream = request.headers.get("accept")?.includes("text/event-stream");

  if (acceptsStream) {
    try {
      const upstream = await proxyToAIStream(
        `/albums/${albumId}/generate`,
        payload,
      );

      if (!upstream.ok) {
        const errorData = await upstream.json().catch(() => ({ detail: "Generation failed." }));
        return NextResponse.json(
          { error: (errorData as Record<string, string>).detail ?? "Generation failed." },
          { status: upstream.status },
        );
      }

      // Stream the response through to the client
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err) {
      console.error("[generate/album] Streaming proxy error:", err);
      return NextResponse.json(
        { error: "Failed to connect to AI backend." },
        { status: 502 },
      );
    }
  }

  // ── Non-streaming JSON response ────────────────────────────────────
  try {
    const result = await proxyToAIJson(
      `/albums/${albumId}/generate`,
      payload,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: (result.data as Record<string, string>)?.detail ?? "Generation failed." },
        { status: result.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("[generate/album] Proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to AI backend." },
      { status: 502 },
    );
  }
}
