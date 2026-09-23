import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api-error";
import { readAgentJob, startChargedAgentJob } from "@/server/agent-jobs";
import { getCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import type { AgentJob } from "@/server/engine";
import { planMonthlyCredits } from "@/server/plan";

const engine = vi.hoisted(() => ({ startAgentJob: vi.fn(), getAgentJob: vi.fn() }));
vi.mock("@/server/engine", () => engine);

// Runs against the Postgres in DATABASE_URL (CI's web job provides one).
const hasDatabase = Boolean(process.env.DATABASE_URL);

function job(jobId: string, status: AgentJob["status"]): AgentJob {
  return { job_id: jobId, status, created_at: 0, completed_at: null, result: null, error: null };
}

describe.skipIf(!hasDatabase)("agent job charges (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  const monthly = planMonthlyCredits("free");
  let workspaceId = "";
  let userId = "";

  beforeEach(async () => {
    vi.resetAllMocks();
    const user = await prisma.user.create({ data: { email: `agentjobs-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Agents", ownerId: user.id } });
    userId = user.id;
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "agentjobs-" } } });
  });

  const start = () =>
    startChargedAgentJob({
      workspaceId,
      plan: "free",
      userId,
      action: "ideation",
      albumId: null,
      job: { action: "ideation", concept: "A record about lighthouses." },
    });

  const balance = async () => (await getCredits({ workspaceId, plan: "free" })).remaining;

  it("charges when the job starts and records the charge by job id", async () => {
    const jobId = `job-${crypto.randomUUID()}`;
    engine.startAgentJob.mockResolvedValue(job(jobId, "pending"));

    await start();

    expect(await balance()).toBe(monthly - 5);
    const charge = await prisma.agentJobCharge.findUnique({ where: { jobId } });
    expect(charge).toMatchObject({ workspaceId, amount: 5, refundedAt: null });
  });

  it("refunds at once when the engine refuses the job", async () => {
    engine.startAgentJob.mockRejectedValue(new ApiError(503, "AI drafting isn't available."));

    await expect(start()).rejects.toMatchObject({ status: 503 });

    expect(await balance()).toBe(monthly);
    expect(await prisma.agentJobCharge.count({ where: { workspaceId } })).toBe(0);
  });

  it("refunds a job that fails after it was accepted, exactly once across racing reads", async () => {
    const jobId = `job-${crypto.randomUUID()}`;
    engine.startAgentJob.mockResolvedValue(job(jobId, "pending"));
    engine.getAgentJob.mockResolvedValue(job(jobId, "failed"));
    await start();

    await Promise.all([1, 2, 3].map(() => readAgentJob(jobId, userId)));
    await readAgentJob(jobId, userId);

    expect(await balance()).toBe(monthly);
    const refunds = await prisma.creditLedgerEntry.findMany({
      where: { workspaceId, reason: "refund:agent_ideation" },
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ delta: 5, metadata: { jobId } });
  });

  it("keeps the charge for a job that completes", async () => {
    const jobId = `job-${crypto.randomUUID()}`;
    engine.startAgentJob.mockResolvedValue(job(jobId, "pending"));
    engine.getAgentJob.mockResolvedValue(job(jobId, "completed"));
    await start();

    await readAgentJob(jobId, userId);

    expect(await balance()).toBe(monthly - 5);
    expect(await prisma.agentJobCharge.findUnique({ where: { jobId } })).toMatchObject({ refundedAt: null });
  });
});
