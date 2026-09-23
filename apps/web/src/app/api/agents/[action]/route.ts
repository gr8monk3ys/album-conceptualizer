import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiError,
  apiHandler,
  enforceRateLimit,
  parseJsonBody,
  requireAlbum,
  requireWorkspace,
} from "@/server/api";
import { CREDIT_COSTS, withCredits } from "@/server/credits";
import { startAgentJob, type AgentAction, type AgentInput } from "@/server/engine";

export const runtime = "nodejs";

const IdeationSchema = z.object({
  concept: z.string().trim().min(1, "Concept is required.").max(4_000),
  references: z.string().max(4_000).optional(),
  themes: z.string().max(4_000).optional(),
  track_count: z.number().int().min(3).max(25).optional(),
});

const SongDevelopmentSchema = z.object({
  album_id: z.string().min(1),
  song_title: z.string().trim().min(1).max(200),
  track_number: z.number().int().min(1),
  mood: z.string().max(500).optional(),
  style_reference: z.string().max(500).optional(),
  song_structure: z.string().max(500).optional(),
});

const CoherenceReviewSchema = z.object({
  album_id: z.string().min(1),
});

const ACTIONS: readonly AgentAction[] = ["ideation", "song-development", "coherence-review"];

function isAgentAction(value: string): value is AgentAction {
  return (ACTIONS as readonly string[]).includes(value);
}

export const POST = apiHandler(
  async (request: Request, { params }: { params: Promise<{ action: string }> }) => {
    const { userId, workspaceId, plan } = await requireWorkspace();
    const { action } = await params;
    if (!isAgentAction(action)) throw new ApiError(404, "Unknown agent action.");

    await enforceRateLimit(
      "agents_start",
      `user:${userId}`,
      "Too many agent requests. Please wait a moment.",
    );

    // Albums live in this app's database, so the engine gets the album snapshot itself.
    let input: AgentInput;
    let albumId: string | null = null;
    if (action === "ideation") {
      input = { action, ...(await parseJsonBody(request, IdeationSchema)) };
    } else if (action === "song-development") {
      const { album_id, ...rest } = await parseJsonBody(request, SongDevelopmentSchema);
      const album = await requireAlbum(workspaceId, album_id, { data: true });
      albumId = album_id;
      input = { action, album: album.data, ...rest };
    } else {
      const { album_id } = await parseJsonBody(request, CoherenceReviewSchema);
      const album = await requireAlbum(workspaceId, album_id, { data: true });
      albumId = album_id;
      input = { action, album: album.data };
    }

    const job = await withCredits(
      {
        workspaceId,
        plan,
        amount: CREDIT_COSTS.agentRun,
        reason: `agent_${action}`,
        metadata: { action, albumId },
        insufficientMessage:
          "Not enough credits to run an agent workflow. Complete challenges or upgrade.",
      },
      () => startAgentJob(input, userId),
    );
    return NextResponse.json(job, { status: 202 });
  },
);
