import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { BillingPlans } from "@/components/billing-plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const subscription = await prisma.subscription.findUnique({
    where: { workspaceId: workspace.id },
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  });

  return (
    <BillingPlans
      workspaceName={workspace.name}
      currentPlan={subscription?.plan ?? "free"}
      status={subscription?.status ?? "inactive"}
      currentPeriodEnd={subscription?.currentPeriodEnd?.toISOString() ?? null}
      hasCustomer={Boolean(subscription?.stripeCustomerId)}
    />
  );
}

