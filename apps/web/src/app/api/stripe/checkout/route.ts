import { NextResponse } from "next/server";

import { getStripe } from "@/server/stripe";

type CheckoutBody = {
  plan?: "free" | "pro" | "team";
};

const PLAN_TO_PRICE_ENV: Record<NonNullable<CheckoutBody["plan"]>, string> = {
  free: "STRIPE_PRICE_ID_FREE",
  pro: "STRIPE_PRICE_ID_PRO",
  team: "STRIPE_PRICE_ID_TEAM",
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as CheckoutBody;
  const plan = payload.plan ?? "pro";
  const priceEnv = PLAN_TO_PRICE_ENV[plan];
  const priceId = process.env[priceEnv];
  if (!priceId) {
    return NextResponse.json(
      { error: `${priceEnv} is not set.` },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const successUrl = `${appUrl}/app/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/app/settings/billing?canceled=1`;

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      plan,
      // TODO: attach workspaceId/userId after auth wiring.
    },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
