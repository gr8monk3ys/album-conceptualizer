import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getDailyChallenge, getUtcDay, isKnownChallenge } from "@/server/challenges";
import { grantCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

const BodySchema = z.object({
  challengeKey: z.string().trim().min(1).max(64),
  notes: z.string().trim().min(10).max(800).optional(),
  // What the entry was written for, if the artist said: an album in this workspace, and
  // optionally one of its tracks.
  albumId: z.string().min(1).max(64).optional(),
  trackNumber: z.number().int().min(1).max(999).optional(),
});

export const POST = apiHandler(async (request: Request) => {
  const { workspaceId, plan } = await requireWorkspace();
  const payload = await parseJsonBody(request, BodySchema);

  const today = getUtcDay();
  const { challenge } = getDailyChallenge(today);
  if (!isKnownChallenge(payload.challengeKey)) throw new ApiError(400, "Unknown challenge.");
  // Only today's challenge (UTC day boundary) can be completed.
  if (payload.challengeKey !== challenge.key) {
    throw new ApiError(409, "That challenge is not active today.");
  }
  if (payload.trackNumber && !payload.albumId) {
    throw new ApiError(400, "Choose the album before the track.");
  }
  // 404s unless the album is in the caller's workspace.
  if (payload.albumId) await requireAlbum(workspaceId, payload.albumId, { id: true });

  try {
    const balance = await getPrisma().$transaction(async (tx) => {
      await tx.challengeCompletion.create({
        data: {
          workspaceId,
          challengeKey: challenge.key,
          challengeDay: today,
          notes: payload.notes ?? null,
          albumId: payload.albumId ?? null,
          trackNumber: payload.albumId ? (payload.trackNumber ?? null) : null,
          creditsEarned: challenge.credits,
        },
        select: { id: true },
      });
      return grantCredits(tx, {
        workspaceId,
        plan,
        amount: challenge.credits,
        reason: `challenge:${challenge.key}`,
        metadata: { day: today, key: challenge.key },
      });
    });
    return NextResponse.json({ ok: true, balance });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "Already completed today.");
    }
    throw err;
  }
});
