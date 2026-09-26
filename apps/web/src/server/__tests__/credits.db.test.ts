import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@/server/api-error";
import { chargeCredits, getCredits, grantCredits, withCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { planMonthlyCredits } from "@/server/plan";

// Runs against the Postgres in DATABASE_URL (CI's web job provides one).
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("credits (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  let workspaceId = "";

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `credits-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Credits", ownerId: user.id } });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "credits-" } } });
  });

  const charge = (amount: number) =>
    prisma.$transaction((tx) =>
      chargeCredits(tx, {
        workspaceId,
        plan: "free",
        amount,
        reason: "test",
        insufficientMessage: "Not enough.",
      }),
    );

  it("grants the plan's monthly credits once, then charges deplete them", async () => {
    const monthly = planMonthlyCredits("free");
    expect(await getCredits({ workspaceId, plan: "free" })).toEqual({ remaining: monthly, total: monthly });
    expect(await charge(5)).toBe(monthly - 5);
    // A second read in the same month does not top the balance back up.
    expect((await getCredits({ workspaceId, plan: "free" })).remaining).toBe(monthly - 5);

    const grants = await prisma.creditLedgerEntry.count({ where: { workspaceId, reason: "monthly_grant" } });
    expect(grants).toBe(1);
  });

  it("refuses a charge the balance can't cover, with a 402", async () => {
    const error = await charge(planMonthlyCredits("free") + 1).catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(402);
  });

  it("never overspends under concurrent charges", async () => {
    const monthly = planMonthlyCredits("free");
    const results = await Promise.allSettled(Array.from({ length: 15 }, () => charge(5)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(Math.floor(monthly / 5));
    expect((await getCredits({ workspaceId, plan: "free" })).remaining).toBe(monthly % 5);
  });

  it("adds the difference when the plan is upgraded mid-month", async () => {
    await charge(10);
    const { remaining } = await getCredits({ workspaceId, plan: "pro" });
    expect(remaining).toBe(planMonthlyCredits("pro") - 10);
  });

  it("keeps earned credits above the monthly amount", async () => {
    await prisma.$transaction((tx) =>
      grantCredits(tx, { workspaceId, plan: "free", amount: 25, reason: "challenge:test" }),
    );
    expect((await getCredits({ workspaceId, plan: "free" })).remaining).toBe(planMonthlyCredits("free") + 25);
  });

  it("refunds the charge when the work fails", async () => {
    const monthly = planMonthlyCredits("free");
    await expect(
      withCredits(
        { workspaceId, plan: "free", amount: 5, reason: "export_zip", insufficientMessage: "no" },
        async () => {
          throw new ApiError(502, "engine down");
        },
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect((await getCredits({ workspaceId, plan: "free" })).remaining).toBe(monthly);
    const refund = await prisma.creditLedgerEntry.findFirst({ where: { workspaceId, reason: "refund:export_zip" } });
    expect(refund?.delta).toBe(5);
  });
});
