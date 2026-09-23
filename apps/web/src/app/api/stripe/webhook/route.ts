import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { ApiError, apiHandler } from "@/server/api";
import { getPrisma } from "@/server/db";
import { planForPrice, requireStripe, type PaidPlan } from "@/server/stripe";

export const runtime = "nodejs";

// The plan always comes from the subscription's price, never from client-writable metadata.
// Every handler is an idempotent upsert keyed by workspace or subscription id, so Stripe's
// retries and out-of-order deliveries converge on the latest subscription state.

function subscriptionPlan(subscription: Stripe.Subscription): PaidPlan | null {
  return planForPrice(subscription.items?.data?.[0]?.price?.id);
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
  const end = subscription.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  workspaceId: string | null,
  stripeCustomerId: string | null,
) {
  const prisma = getPrisma();
  const plan = subscriptionPlan(subscription);
  const data = {
    status: subscription.status ?? "inactive",
    currentPeriodEnd: periodEnd(subscription),
    stripeSubscriptionId: subscription.id,
    ...(plan ? { plan } : {}),
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
  };

  if (workspaceId) {
    await prisma.subscription.upsert({
      where: { workspaceId },
      create: { workspaceId, plan: plan ?? "free", ...data },
      update: data,
    });
    return;
  }
  await prisma.subscription.updateMany({ where: { stripeSubscriptionId: subscription.id }, data });
}

export const POST = apiHandler(async (request: Request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new ApiError(503, "Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET missing).");
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new ApiError(400, "Missing stripe-signature header.");

  const rawBody = await request.text();
  const stripe = requireStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("stripe_webhook_signature_verification_failed", err);
    throw new ApiError(400, "Webhook signature verification failed.");
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.client_reference_id ?? session.metadata?.workspaceId ?? null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (workspaceId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customer = typeof session.customer === "string" ? session.customer : null;
        await syncSubscription(subscription, workspaceId, customer);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription, subscription.metadata?.workspaceId ?? null, null);
    }
  } catch (err) {
    console.error("stripe_webhook_processing_error", err);
    throw new ApiError(500, "Webhook processing failed.");
  }

  return NextResponse.json({ received: true, type: event.type });
});
