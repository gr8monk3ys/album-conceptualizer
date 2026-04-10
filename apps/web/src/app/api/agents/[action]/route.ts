import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getCreditsStatus, InsufficientCreditsError, spendCredits } from "@/server/credits";
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

type AgentAction = "ideation" | "song-development" | "coherence-review";
const AGENT_ACTIONS: readonly AgentAction[] = [
  "ideation",
  "song-development",
  "coherence-review",
] as const;
function isAgentAction(value: string): value is AgentAction {
  return (AGENT_ACTIONS as readonly string[]).includes(value);
}

function engineErrorResponse(err: EngineError) {
  const upstream = err.status >= 400 && err.status < 500 ? err.status : 502;
  return NextResponse.json(
    { error: `Agents engine error: ${err.detail}` },
    { status: upstream },
  );
}

const AGENT_CREDIT_COST = 5;

async function jobResponseWithCredits(
  job: AgentJob,
  workspaceId: string,
  plan: string,
  action: string,
) {
  try {
    await spendCredits({
      workspaceId,
      plan,
      amount: AGENT_CREDIT_COST,
      reason: `agent_${action}`,
      metadata: { jobId: job.job_id, action },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits to run an agent workflow." },
        { status: 402 },
      );
    }
    // Credit deduction failed but job already started — log and continue.
    // The job is valuable even if we couldn't charge for it.
  }
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
  { params }: { params: Promise<{ action: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { action } = await params;
  if (!isAgentAction(action)) {
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
  const plan = workspace.subscription?.plan ?? "free";

  const creditStatus = await getCreditsStatus({ workspaceId: workspace.id, plan });
  if (creditStatus.remaining < 5) {
    return NextResponse.json(
      { error: "Not enough credits to run an agent workflow. Complete challenges or upgrade." },
      { status: 402 },
    );
  }

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
    return jobResponseWithCredits(result, workspace.id, plan, action);
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
    return jobResponseWithCredits(result, workspace.id, plan, action);
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
  return jobResponseWithCredits(result, workspace.id, plan, action);
}
