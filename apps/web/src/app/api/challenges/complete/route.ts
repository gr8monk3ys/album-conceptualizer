import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { getDailyChallenge, getUtcDay, isKnownChallenge } from "@/server/challenges";
import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { planCreditsTotal } from "@/server/credits";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const BodySchema = z.object({
  challengeKey: z.string().trim().min(1).max(64),
  notes: z.string().trim().min(10).max(800).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const today = getUtcDay();
  const { challenge } = getDailyChallenge(today);

  if (!isKnownChallenge(payload.data.challengeKey)) {
    return NextResponse.json({ error: "Unknown challenge." }, { status: 400 });
  }

  // Only allow completing today's challenge (UTC day boundary) to keep this simple.
  if (payload.data.challengeKey !== challenge.key) {
    return NextResponse.json({ error: "That challenge is not active today." }, { status: 409 });
  }

  const prisma = getPrisma();
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = workspace.subscription?.plan ?? "free";
  const baseline = planCreditsTotal(plan);

  try {
    const balance = await prisma.$transaction(async (tx) => {
      // Ensure a balance row exists (and stays at least baseline on upgrades).
      const existing = await tx.creditBalance.upsert({
        where: { workspaceId: workspace.id },
        create: { workspaceId: workspace.id, balance: baseline },
        update: {},
        select: { balance: true },
      });
      if (existing.balance < baseline) {
        await tx.creditBalance.update({
          where: { workspaceId: workspace.id },
          data: { balance: baseline },
          select: { balance: true },
        });
      }

      await tx.challengeCompletion.create({
        data: {
          workspaceId: workspace.id,
          challengeKey: challenge.key,
          challengeDay: today,
          notes: payload.data.notes ?? null,
          creditsEarned: challenge.credits,
        },
        select: { id: true },
      });

      await tx.creditLedgerEntry.create({
        data: {
          workspaceId: workspace.id,
          delta: challenge.credits,
          reason: `challenge:${challenge.key}`,
          metadata: { day: today, key: challenge.key },
        },
        select: { id: true },
      });

      const updated = await tx.creditBalance.update({
        where: { workspaceId: workspace.id },
        data: { balance: { increment: challenge.credits } },
        select: { balance: true },
      });

      return updated.balance;
    });

    return NextResponse.json({ ok: true, balance });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Already completed today." }, { status: 409 });
    }
    console.error("Failed to record challenge completion:", err);
    return NextResponse.json({ error: "Could not record completion." }, { status: 500 });
  }
}
