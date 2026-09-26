import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { recordLyricsBaseline, startOfUtcDay } from "@/server/challenge-verification";
import { getDailyChallenge, getUtcDay } from "@/server/challenges";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

const BodySchema = z.object({
  challengeKey: z.string().trim().min(1).max(64),
  albumId: z.string().min(1).max(64),
});

/**
 * The Studio opened today's challenge on an album (its challenge band, `?challenge=<key>`).
 * Like opening the Challenges page, this records where the album's lyrics stand before the
 * challenge's writing, so what is written after it is what the credits pay for
 * (`checkChallengeWriting`); an album that already has today's baseline keeps it, and an album
 * made today counts from nothing, as always. Says whether the challenge is still today's and
 * whether today's credits were already earned, so the band offers a claim only when one can pay.
 */
export const POST = apiHandler(async (request: Request) => {
  const { workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, BodySchema);

  const now = new Date();
  const today = getUtcDay(now);
  const { challenge } = getDailyChallenge(today);
  if (payload.challengeKey !== challenge.key) {
    return NextResponse.json({ active: false, done: false, todayTitle: challenge.title });
  }
  // 404s unless the album is in the caller's workspace.
  const album = await requireAlbum(workspaceId, payload.albumId, { id: true, data: true, createdAt: true });

  const prisma = getPrisma();
  if (album.createdAt < startOfUtcDay(now)) {
    await recordLyricsBaseline(prisma, album.id, album.data, now);
  }
  const completion = await prisma.challengeCompletion.findFirst({
    where: { workspaceId, challengeKey: challenge.key, challengeDay: today },
    select: { creditsEarned: true },
  });
  return NextResponse.json({
    active: true,
    done: Boolean(completion && completion.creditsEarned > 0),
    todayTitle: challenge.title,
  });
});
