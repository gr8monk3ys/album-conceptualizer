import { NextResponse } from "next/server";

import { getStripe } from "@/server/stripe";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";

type CheckoutBody = {
  plan?: "free" | "pro" | "team";
};

const PLAN_TO_PRICE_ENV: Record<NonNullable<CheckoutBody["plan"]>, string> = {
  free: "STRIPE_PRICE_ID_FREE",
  pro: "STRIPE_PRICE_ID_PRO",
  team: "STRIPE_PRICE_ID_TEAM",
};

export async function POST(request: Request) {
  const authSession = await getAuthSession();
  const userId = authSession?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rate = await checkRateLimit("stripe", `user:${userId}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many billing attempts. Please wait a bit and try again." },
      { status: 429, headers: getRateLimitHeaders(rate) },
    );
  }

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

  const workspace = await getActiveWorkspaceForUser(userId);

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: workspace.id,
    customer_email: authSession.user?.email ?? undefined,
    metadata: {
      plan,
      workspaceId: workspace.id,
      userId,
    },
    subscription_data: {
      metadata: {
        workspaceId: workspace.id,
        userId,
        plan,
      },
    },
  });

  return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id });
}
