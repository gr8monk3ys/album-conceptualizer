import { NextResponse } from "next/server";

import { ApiError, apiHandler, enforceRateLimit, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { createPortalSession, requireStripe, stripeFailure } from "@/server/stripe";

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
  try {
    const portal = await createPortalSession(stripe, subscription.stripeCustomerId);
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    throw stripeFailure(err, "portal");
  }
});
