import { NextResponse } from "next/server";

import { ApiError, apiHandler, enforceRateLimit, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { requireStripe, stripeFailure } from "@/server/stripe";

export const runtime = "nodejs";

export const POST = apiHandler(async () => {
  const { userId, workspaceId } = await requireWorkspace();
  await enforceRateLimit(
    "stripe",
    `user:${userId}`,
    "Too many billing attempts. Please wait a bit and try again.",
  );

  const subscription = await getPrisma().subscription.findUnique({
    where: { workspaceId },
    select: { stripeCustomerId: true },
  });
  if (!subscription?.stripeCustomerId) {
    throw new ApiError(400, "No Stripe customer found for this workspace yet.");
  }

  const stripe = requireStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/app/settings/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    throw stripeFailure(err, "portal");
  }
});
