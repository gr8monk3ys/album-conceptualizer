import { BillingPlans } from "@/components/billing-plans";
import { getPrisma } from "@/server/db";
import { getAgentAvailability } from "@/server/engine";
import { requireUser } from "@/server/identity";
import { effectivePlan, FREE_PROJECT_LIMIT, planMonthlyCredits } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Plan and billing",
  description: "Compare plans, see what credits pay for, and manage payment.",
};

export default async function BillingPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const [subscription, aiAvailable] = await Promise.all([
    prisma.subscription.findUnique({
      where: { workspaceId: workspace.id },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    }),
    // Plans don't sell AI drafts the server can't run (the same check the AI controls use).
    getAgentAvailability(),
  ]);

  return (
    <BillingPlans
      workspaceName={workspace.name}
      currentPlan={effectivePlan(subscription)}
      subscribedPlan={subscription?.plan ?? "free"}
      status={subscription?.status ?? "inactive"}
      currentPeriodEnd={subscription?.currentPeriodEnd?.toISOString() ?? null}
      hasCustomer={Boolean(subscription?.stripeCustomerId)}
      monthlyCredits={{
        free: planMonthlyCredits("free"),
        pro: planMonthlyCredits("pro"),
        team: planMonthlyCredits("team"),
      }}
      freeProjectLimit={FREE_PROJECT_LIMIT}
      aiAvailable={aiAvailable}
    />
  );
}
