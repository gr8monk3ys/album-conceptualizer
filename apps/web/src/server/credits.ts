import type { Prisma } from "@prisma/client";

import { ApiError } from "@/server/api-error";
import { getPrisma } from "@/server/db";
import { planMonthlyCredits, type Plan } from "@/server/plan";

// Every workspace gets its plan's credits once per UTC calendar month. The grant tops the
// balance up to the plan's monthly amount (earned credits above it are kept) and is recorded
// in the ledger, which is also how we know whether this month's grant already happened.
// An upgrade mid-month adds the difference between the two plans' amounts.

export const CREDIT_COSTS = {
  albumCreate: 5,
  albumFork: 5,
  exportZip: 2,
  agentRun: 5,
} as const;

const GRANT_REASON = "monthly_grant";

type Tx = Prisma.TransactionClient;

type CreditSubject = { workspaceId: string; plan: Plan };

function currentPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, label };
}

function grantedAmount(metadata: Prisma.JsonValue | null): number {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).monthlyCredits;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

/**
 * Lock the workspace's balance row for the rest of the transaction, applying this month's
 * grant first if it is due. Returns the balance after the grant.
 */
async function lockBalance(tx: Tx, { workspaceId, plan }: CreditSubject): Promise<number> {
  // INSERT … ON CONFLICT DO NOTHING: unlike upsert, safe when two first requests race.
  await tx.creditBalance.createMany({ data: [{ workspaceId, balance: 0 }], skipDuplicates: true });
  // A no-op UPDATE takes the row lock, so concurrent charges and grants serialize here.
  const locked = await tx.creditBalance.update({
    where: { workspaceId },
    data: { balance: { increment: 0 } },
    select: { balance: true },
  });

  const monthly = planMonthlyCredits(plan);
  const period = currentPeriod();
  const grants = await tx.creditLedgerEntry.findMany({
    where: { workspaceId, reason: GRANT_REASON, createdAt: { gte: period.start } },
    select: { metadata: true },
  });
  const alreadyGranted = grants.reduce((max, entry) => Math.max(max, grantedAmount(entry.metadata)), 0);
  if (alreadyGranted >= monthly) return locked.balance;

  const delta =
    grants.length === 0
      ? Math.max(0, monthly - locked.balance)
      : monthly - alreadyGranted;

  await tx.creditLedgerEntry.create({
    data: {
      workspaceId,
      delta,
      reason: GRANT_REASON,
      metadata: { period: period.label, plan, monthlyCredits: monthly },
    },
    select: { id: true },
  });
  if (delta === 0) return locked.balance;
  const updated = await tx.creditBalance.update({
    where: { workspaceId },
    data: { balance: { increment: delta } },
    select: { balance: true },
  });
  return updated.balance;
}

export async function getCredits(subject: CreditSubject) {
  const remaining = await getPrisma().$transaction((tx) => lockBalance(tx, subject));
  return { remaining, total: planMonthlyCredits(subject.plan) };
}

/** Add earned credits (challenges, refunds) to a workspace. Returns the new balance. */
export async function grantCredits(
  tx: Tx,
  input: CreditSubject & { amount: number; reason: string; metadata?: Prisma.InputJsonValue },
): Promise<number> {
  await lockBalance(tx, input);
  await tx.creditLedgerEntry.create({
    data: {
      workspaceId: input.workspaceId,
      delta: input.amount,
      reason: input.reason,
      metadata: input.metadata,
    },
    select: { id: true },
  });
  const updated = await tx.creditBalance.update({
    where: { workspaceId: input.workspaceId },
    data: { balance: { increment: input.amount } },
    select: { balance: true },
  });
  return updated.balance;
}

type Charge = CreditSubject & {
  amount: number;
  reason: string;
  metadata?: Prisma.InputJsonValue;
  insufficientMessage: string;
};

/**
 * Charge credits inside the caller's transaction, so the charge commits or rolls back with
 * the caller's own writes. The balance row stays locked until that transaction ends, which
 * also serializes other per-workspace checks made after it (such as the project limit).
 * Throws a 402 ApiError when the balance is too low.
 */
export async function chargeCredits(tx: Tx, charge: Charge): Promise<number> {
  const amount = Math.trunc(charge.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid credit charge amount.");
  const balance = await lockBalance(tx, charge);
  if (balance < amount) throw new ApiError(402, charge.insufficientMessage);
  await tx.creditLedgerEntry.create({
    data: {
      workspaceId: charge.workspaceId,
      delta: -amount,
      reason: charge.reason,
      metadata: charge.metadata,
    },
    select: { id: true },
  });
  const updated = await tx.creditBalance.update({
    where: { workspaceId: charge.workspaceId },
    data: { balance: { decrement: amount } },
    select: { balance: true },
  });
  return updated.balance;
}

/**
 * Charge credits for work outside the database (an engine call), then run it. If `work`
 * throws, the charge is refunded and the error rethrown.
 */
export async function withCredits<T>(charge: Charge, work: () => Promise<T>): Promise<T> {
  const prisma = getPrisma();
  await prisma.$transaction((tx) => chargeCredits(tx, charge));
  try {
    return await work();
  } catch (err) {
    await prisma
      .$transaction((tx) =>
        grantCredits(tx, {
          workspaceId: charge.workspaceId,
          plan: charge.plan,
          amount: Math.trunc(charge.amount),
          reason: `refund:${charge.reason}`,
          metadata: charge.metadata,
        }),
      )
      .catch((refundError) => {
        console.error("credit_refund_failed", { workspaceId: charge.workspaceId, refundError });
      });
    throw err;
  }
}
