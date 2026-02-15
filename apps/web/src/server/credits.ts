import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/server/db";

export class InsufficientCreditsError extends Error {
  constructor(message: string = "Insufficient credits.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export function planCreditsTotal(plan: string | null | undefined): number {
  if (plan === "team") return 500;
  if (plan === "pro") return 200;
  return 50;
}

export async function ensureCreditBalance(workspaceId: string, plan: string | null | undefined) {
  const prisma = getPrisma();
  const baseline = planCreditsTotal(plan);

  const current = await prisma.creditBalance.upsert({
    where: { workspaceId },
    create: { workspaceId, balance: baseline },
    update: {},
    select: { balance: true },
  });

  if (current.balance >= baseline) return current.balance;

  // If a workspace upgrades and the existing balance is below the new baseline,
  // bump them up to the baseline.
  const updated = await prisma.creditBalance.update({
    where: { workspaceId },
    data: { balance: baseline },
    select: { balance: true },
  });
  return updated.balance;
}

export async function getCreditsStatus(input: {
  workspaceId: string;
  plan: string | null | undefined;
}) {
  const baseline = planCreditsTotal(input.plan);
  const balance = await ensureCreditBalance(input.workspaceId, input.plan);
  return {
    remaining: balance,
    total: baseline,
  };
}

export async function grantCredits(input: {
  workspaceId: string;
  plan: string | null | undefined;
  amount: number;
  reason: string;
  metadata?: unknown;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Invalid credit grant amount.");
  }

  const prisma = getPrisma();
  await ensureCreditBalance(input.workspaceId, input.plan);

  const result = await prisma.$transaction(async (tx) => {
    await tx.creditLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        delta: Math.trunc(input.amount),
        reason: input.reason,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    const balance = await tx.creditBalance.update({
      where: { workspaceId: input.workspaceId },
      data: { balance: { increment: Math.trunc(input.amount) } },
      select: { balance: true },
    });

    return balance.balance;
  });

  return result;
}

export async function spendCredits(input: {
  workspaceId: string;
  plan: string | null | undefined;
  amount: number;
  reason: string;
  metadata?: unknown;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Invalid credit spend amount.");
  }

  const prisma = getPrisma();
  await ensureCreditBalance(input.workspaceId, input.plan);
  const amount = Math.trunc(input.amount);

  const balance = await prisma.$transaction(async (tx) => {
    const updated = await tx.creditBalance.updateMany({
      where: {
        workspaceId: input.workspaceId,
        balance: { gte: amount },
      },
      data: { balance: { decrement: amount } },
    });

    if (updated.count !== 1) {
      throw new InsufficientCreditsError(
        `Not enough credits. Need ${amount}, but your balance is too low.`,
      );
    }

    await tx.creditLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        delta: -amount,
        reason: input.reason,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    const latest = await tx.creditBalance.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { balance: true },
    });

    return latest?.balance ?? 0;
  });

  return balance;
}
