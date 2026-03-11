import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getPrisma } from "@/server/db";
import { getStripe } from "@/server/stripe";
import { ensureCreditBalance } from "@/server/credits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET missing)." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();
  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      const plan = session.metadata?.plan ?? "pro";
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (workspaceId) {
        await prisma.subscription.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            plan,
            status: "active",
            stripeCustomerId,
            stripeSubscriptionId,
          },
          update: {
            plan,
            status: "active",
            stripeCustomerId,
            stripeSubscriptionId,
          },
        });

        // Bump the workspace balance to at least the plan baseline on purchase.
        await ensureCreditBalance(workspaceId, plan);
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubscriptionId = subscription.id;
      const status = subscription.status ?? "inactive";
      const itemPeriodEnd = subscription.items?.data?.[0]?.current_period_end;
      const currentPeriodEnd = itemPeriodEnd ? new Date(itemPeriodEnd * 1000) : null;

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId },
        data: {
          status,
          currentPeriodEnd: currentPeriodEnd ?? undefined,
        },
      });
    }
  } catch (err) {
    console.error("stripe_webhook_error", err);
    const message = err instanceof Error ? err.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true, type: event.type });
}
