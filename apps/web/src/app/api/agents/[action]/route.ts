import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit, getRateLimitFailure } from "@/server/rate-limit";
import {
  isEngineError,
  startCoherenceReview,
  startIdeation,
  startSongDevelopment,
  type AgentJob,
  type EngineError,
} from "@/server/agents";

export const runtime = "nodejs";

const IdeationSchema = z.object({
  concept: z.string().min(1, "Concept is required."),
  references: z.string().optional(),
  themes: z.string().optional(),
  track_count: z.number().int().min(3).max(25).optional(),
});

const SongDevelopmentSchema = z.object({
  album_id: z.string().min(1),
  song_title: z.string().min(1),
  track_number: z.number().int().min(1),
  mood: z.string().optional(),
  style_reference: z.string().optional(),
  song_structure: z.string().optional(),
});

const CoherenceReviewSchema = z.object({
  album_id: z.string().min(1),
});

type ActionParams = { action: "ideation" | "song-development" | "coherence-review" };

function engineErrorResponse(err: EngineError) {
  const upstream = err.status >= 400 && err.status < 500 ? err.status : 502;
  return NextResponse.json(
    { error: `Agents engine error: ${err.detail}` },
    { status: upstream },
  );
}

function jobResponse(job: AgentJob) {
  return NextResponse.json(job, { status: 202 });
}

async function ensureAlbumOwned(workspaceId: string, albumId: string): Promise<boolean> {
  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId },
    select: { id: true },
  });
  return album !== null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<ActionParams> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { action } = await params;
  if (
    action !== "ideation" &&
    action !== "song-development" &&
    action !== "coherence-review"
  ) {
    return NextResponse.json({ error: "Unknown agent action." }, { status: 404 });
  }

  const rate = await checkRateLimit("agents_start", `user:${userId}`);
  const rateFailure = getRateLimitFailure(rate, "Too many agent requests. Please wait a moment.");
  if (rateFailure) {
    return NextResponse.json(rateFailure.body, {
      status: rateFailure.status,
      headers: rateFailure.headers,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const workspace = await getActiveWorkspaceForUser(userId);

  if (action === "ideation") {
    const parsed = IdeationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }
    const result = await startIdeation(parsed.data);
    if (isEngineError(result)) return engineErrorResponse(result);
    return jobResponse(result);
  }

  if (action === "song-development") {
    const parsed = SongDevelopmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }
    const owned = await ensureAlbumOwned(workspace.id, parsed.data.album_id);
    if (!owned) return NextResponse.json({ error: "Album not found." }, { status: 404 });
    const result = await startSongDevelopment(parsed.data);
    if (isEngineError(result)) return engineErrorResponse(result);
    return jobResponse(result);
  }

  // coherence-review
  const parsed = CoherenceReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const owned = await ensureAlbumOwned(workspace.id, parsed.data.album_id);
  if (!owned) return NextResponse.json({ error: "Album not found." }, { status: 404 });
  const result = await startCoherenceReview(parsed.data);
  if (isEngineError(result)) return engineErrorResponse(result);
  return jobResponse(result);
}
