import { CREDIT_COSTS, grantCredits, withCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { getAgentJob, startAgentJob, type AgentAction, type AgentInput, type AgentJob } from "@/server/engine";
import { effectivePlan, type Plan } from "@/server/plan";

// Agent jobs are paid for when they start. If the engine refuses the job, withCredits refunds
// at once; if the job is accepted and later fails (a crew error, the engine's timeout), the
// refund happens the first time anyone reads the failed job. The AgentJobCharge row is what
// makes that refund happen exactly once: the refund claims the row by setting refundedAt.
// A job the engine has forgotten (completed jobs expire after an hour) is never refunded,
// because "not found" doesn't say whether it failed.

/** Charge for an agent run, start it on the engine, and remember the charge by job id. */
export async function startChargedAgentJob(input: {
  workspaceId: string;
  plan: Plan;
  userId: string;
  action: AgentAction;
  albumId: string | null;
  job: AgentInput;
}): Promise<AgentJob> {
  const amount = CREDIT_COSTS.agentRun;
  const reason = `agent_${input.action}`;
  return withCredits(
    {
      workspaceId: input.workspaceId,
      plan: input.plan,
      amount,
      reason,
      metadata: { action: input.action, albumId: input.albumId },
      insufficientMessage:
        "Not enough credits to run an agent workflow. Complete challenges or upgrade.",
    },
    async () => {
      const job = await startAgentJob(input.job, input.userId);
      await getPrisma().agentJobCharge.create({
        data: { jobId: job.job_id, workspaceId: input.workspaceId, amount, reason },
        select: { jobId: true },
      });
      return job;
    },
  );
}

/**
 * Refund a failed job's charge, once. Safe to call on every read of the job: only the call
 * that claims the row grants credits, and the claim and the grant commit together.
 * Returns true when this call made the refund.
 */
export async function refundFailedAgentJob(jobId: string): Promise<boolean> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.agentJobCharge.updateMany({
      where: { jobId, refundedAt: null },
      data: { refundedAt: new Date() },
    });
    if (claimed.count !== 1) return false;
    const charge = await tx.agentJobCharge.findUniqueOrThrow({
      where: { jobId },
      select: { workspaceId: true, amount: true, reason: true, workspace: { select: { subscription: true } } },
    });
    await grantCredits(tx, {
      workspaceId: charge.workspaceId,
      plan: effectivePlan(charge.workspace.subscription),
      amount: charge.amount,
      reason: `refund:${charge.reason}`,
      metadata: { jobId },
    });
    return true;
  });
}

/** Read a job for its owner, refunding its charge if it has failed. */
export async function readAgentJob(jobId: string, userId: string): Promise<AgentJob> {
  const job = await getAgentJob(jobId, userId);
  if (job.status === "failed") await refundFailedAgentJob(job.job_id);
  return job;
}
