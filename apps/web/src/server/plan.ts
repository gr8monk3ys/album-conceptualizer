import type { Prisma } from "@prisma/client";

import { ApiError } from "@/server/api-error";

export type Plan = "free" | "pro" | "team";

// Stripe statuses under which a paid plan's entitlements still apply. `past_due` keeps
// access during Stripe's retry window; anything else (canceled, unpaid, incomplete,
// inactive) falls back to the free plan.
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export const FREE_PROJECT_LIMIT = 5;

export function effectivePlan(
  subscription: { plan?: string | null; status?: string | null } | null | undefined,
): Plan {
  const plan = subscription?.plan;
  if (plan !== "pro" && plan !== "team") return "free";
  return ENTITLED_STATUSES.has(subscription?.status ?? "") ? plan : "free";
}

export function planMonthlyCredits(plan: Plan): number {
  if (plan === "team") return 500;
  if (plan === "pro") return 200;
  return 50;
}

/**
 * Refuse a new project on the free plan once the workspace has FREE_PROJECT_LIMIT. Call it
 * inside the creating transaction after `chargeCredits`, whose row lock keeps two
 * concurrent creations from both passing the count.
 */
export async function enforceProjectLimit(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  plan: Plan,
) {
  if (plan !== "free") return;
  const count = await tx.album.count({ where: { workspaceId } });
  if (count >= FREE_PROJECT_LIMIT) {
    throw new ApiError(
      402,
      `The free plan includes ${FREE_PROJECT_LIMIT} projects. Upgrade to create more.`,
    );
  }
}
