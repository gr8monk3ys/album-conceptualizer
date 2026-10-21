import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { ApiError, apiHandler } from "@/server/api";
import { getPrisma } from "@/server/db";
import { ENTITLED_STATUSES } from "@/server/plan";
import { planForPrice, requireStripe, type PaidPlan } from "@/server/stripe";

export const runtime = "nodejs";

// The plan always comes from the subscription's price, never from client-writable metadata.
// Events are only a signal: every handler re-fetches the subscription from Stripe and syncs
// that, so a late or retried delivery can't write back an older state. A workspace follows one
// subscription at a time: events for any other subscription are ignored while the current one
// still carries its plan (active, trialing or past_due).

function subscriptionPlan(subscription: Stripe.Subscription): PaidPlan | null {
  return planForPrice(subscription.items?.data?.[0]?.price?.id);
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
  const end = subscription.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

function customerId(customer: string | { id: string } | null | undefined): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

async function syncSubscription(subscription: Stripe.Subscription, workspaceId: string | null) {
  const prisma = getPrisma();
  const plan = subscriptionPlan(subscription);
  const stripeCustomerId = customerId(subscription.customer);
  const data = {
    status: subscription.status ?? "inactive",
    currentPeriodEnd: periodEnd(subscription),
    stripeSubscriptionId: subscription.id,
    ...(plan ? { plan } : {}),
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
  };

  if (!workspaceId) {
    await prisma.subscription.updateMany({ where: { stripeSubscriptionId: subscription.id }, data });
    return;
  }

  // One conditional UPDATE, so the check and the write can't interleave with another delivery.
  const { count } = await prisma.subscription.updateMany({
    where: {
      workspaceId,
      OR: [
        { stripeSubscriptionId: null },
        { stripeSubscriptionId: subscription.id },
        { status: { notIn: [...ENTITLED_STATUSES] } },
      ],
    },
    data,
  });
  if (count > 0) return;

  const existing = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { stripeSubscriptionId: true },
  });
  if (existing) {
    console.warn("stripe_webhook_ignored_other_subscription", {
      workspaceId,
      subscriptionId: subscription.id,
      currentSubscriptionId: existing.stripeSubscriptionId,
    });
    return;
  }
  // A concurrent first delivery may create the row first; the unique violation then fails
  // this delivery and Stripe's retry takes the update path.
  await prisma.subscription.create({ data: { workspaceId, plan: plan ?? "free", ...data } });
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
        await syncSubscription(subscription, workspaceId);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const { id } = event.data.object as Stripe.Subscription;
      const subscription = await stripe.subscriptions.retrieve(id);
      await syncSubscription(subscription, subscription.metadata?.workspaceId ?? null);
    }
  } catch (err) {
    console.error("stripe_webhook_processing_error", err);
    throw new ApiError(500, "Webhook processing failed.");
  }

  return NextResponse.json({ received: true, type: event.type });
});
