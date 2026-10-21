import { NextResponse } from "next/server";
import { z } from "zod";

import { trackProductEventSafe } from "@/server/analytics";
import { ApiError, apiHandler, enforceRateLimit, parseJsonBody, requireWorkspace } from "@/server/api";
import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { isEntitledStatus } from "@/server/plan";
import { createPortalSession, priceForPlan, requireStripe, stripeFailure } from "@/server/stripe";

export const runtime = "nodejs";

const BodySchema = z.object({
  plan: z.enum(["pro", "team"]).default("pro"),
});

export const POST = apiHandler(async (request: Request) => {
  const { userId, workspaceId } = await requireWorkspace();
  await enforceRateLimit(
    "stripe",
    `user:${userId}`,
    "Too many billing attempts. Please wait a bit and try again.",
  );
  const { plan } = await parseJsonBody(request, BodySchema, "Choose the Pro or Team plan.");
  const priceId = priceForPlan(plan);
  const stripe = requireStripe();
  const current = await getPrisma().subscription.findUnique({
    where: { workspaceId },
    select: { status: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });

  // A workspace that is already paying changes plans on its existing subscription, in the
  // billing portal. A second Checkout would bill two subscriptions at once.
  if (isEntitledStatus(current?.status)) {
    if (!current?.stripeCustomerId) {
      throw new ApiError(409, "This workspace already has a subscription. Change plans from Manage billing.");
    }
    try {
      const portal = await createPortalSession(stripe, current.stripeCustomerId, current.stripeSubscriptionId);
      return NextResponse.json({ url: portal.url, portal: true });
    } catch (err) {
      throw stripeFailure(err, "portal");
    }
  }

  // Subscribing again after a lapse stays on the same Stripe customer (one portal, one history).
  const customer = current?.stripeCustomerId
    ? { customer: current.stripeCustomerId }
    : { customer_email: (await getAuthSession())?.user?.email ?? undefined };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const metadata = { plan, workspaceId, userId };
  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app/settings/billing?canceled=1`,
      allow_promotion_codes: true,
      client_reference_id: workspaceId,
      ...customer,
      metadata,
      subscription_data: { metadata },
    });
  } catch (err) {
    throw stripeFailure(err, "checkout");
  }

  await trackProductEventSafe({
    name: "billing_checkout_started",
    workspaceId,
    userId,
    path: "/api/stripe/checkout",
    metadata: { plan, sessionId: checkoutSession.id },
  });

  return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id });
});
