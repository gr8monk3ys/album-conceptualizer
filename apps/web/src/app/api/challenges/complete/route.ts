import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { findAlbumSongByTrackNumber } from "@/server/album-songs";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import {
  challengeWritingReason,
  checkChallengeWriting,
  startOfUtcDay,
} from "@/server/challenge-verification";
import { getDailyChallenge, getUtcDay, isKnownChallenge } from "@/server/challenges";
import { getCredits, grantCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

const BodySchema = z.object({
  challengeKey: z.string().trim().min(1).max(64),
  notes: z.string().trim().min(10).max(800).optional(),
  // What the entry was written for: an album in this workspace, and optionally one of its
  // tracks. Required, because the credits are paid for writing the album shows.
  albumId: z.string().max(64).optional(),
  trackNumber: z.number().int().min(1).max(999).optional(),
});

/**
 * Saves today's challenge entry. Credits are granted only when the linked track (or album)
 * has written lyrics that are new today (UTC, `checkChallengeWriting`); otherwise the note is
 * saved with 0 credits and the response says why, and the artist can send it again once they
 * have written, which grants the credits then. An entry that has earned its credits is final.
 */
export const POST = apiHandler(async (request: Request) => {
  const { workspaceId, plan } = await requireWorkspace();
  const payload = await parseJsonBody(request, BodySchema);

  const now = new Date();
  const today = getUtcDay(now);
  const { challenge } = getDailyChallenge(today);
  if (!isKnownChallenge(payload.challengeKey)) throw new ApiError(400, "Unknown challenge.");
  // Only today's challenge (UTC day boundary) can be completed.
  if (payload.challengeKey !== challenge.key) {
    throw new ApiError(409, "That challenge is not active today.");
  }
  if (!payload.albumId) {
    throw new ApiError(400, "Choose the album you wrote in: the credits are for writing it shows.");
  }
  // 404s unless the album is in the caller's workspace.
  const album = await requireAlbum(workspaceId, payload.albumId, {
    id: true,
    title: true,
    data: true,
    createdAt: true,
    updatedAt: true,
  });
  const trackNumber = payload.trackNumber ?? null;
  if (trackNumber !== null && !findAlbumSongByTrackNumber(album.data, trackNumber)) {
    throw new ApiError(400, "That track isn't on the album any more. Choose another.");
  }

  const prisma = getPrisma();
  const dayStart = startOfUtcDay(now);
  const [versionBeforeToday, firstVersion, existing] = await Promise.all([
    prisma.albumVersion.findFirst({
      where: { albumId: album.id, createdAt: { lt: dayStart } },
      orderBy: { createdAt: "desc" },
      select: { data: true },
    }),
    prisma.albumVersion.findFirst({
      where: { albumId: album.id },
      orderBy: { createdAt: "asc" },
      select: { data: true },
    }),
    prisma.challengeCompletion.findFirst({
      where: { workspaceId, challengeKey: challenge.key, challengeDay: today },
      select: { id: true, creditsEarned: true },
    }),
  ]);
  if (existing && existing.creditsEarned > 0) throw new ApiError(409, "Already completed today.");

  const check = checkChallengeWriting({ now, album, trackNumber, versionBeforeToday, firstVersion });
  const earned = check.verified ? challenge.credits : 0;
  const entry = {
    notes: payload.notes ?? null,
    albumId: album.id,
    trackNumber,
    creditsEarned: earned,
  };

  try {
    const balance = await prisma.$transaction(async (tx) => {
      if (existing) {
        // Only an entry still at 0 credits is updated, so two sends can't both be paid.
        const updated = await tx.challengeCompletion.updateMany({
          where: { id: existing.id, creditsEarned: 0 },
          data: entry,
        });
        if (!updated.count) throw new ApiError(409, "Already completed today.");
      } else {
        await tx.challengeCompletion.create({
          data: { workspaceId, challengeKey: challenge.key, challengeDay: today, ...entry },
          select: { id: true },
        });
      }
      if (!earned) return null;
      return grantCredits(tx, {
        workspaceId,
        plan,
        amount: earned,
        reason: `challenge:${challenge.key}`,
        metadata: { day: today, key: challenge.key, albumId: album.id, trackNumber },
      });
    });

    if (check.verified) {
      return NextResponse.json({ ok: true, credited: true, creditsEarned: earned, balance });
    }
    const { remaining } = await getCredits({ workspaceId, plan });
    return NextResponse.json({
      ok: true,
      credited: false,
      creditsEarned: 0,
      balance: remaining,
      reason: challengeWritingReason(check.reason, { albumTitle: album.title, trackNumber }),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "Already completed today.");
    }
    throw err;
  }
});
