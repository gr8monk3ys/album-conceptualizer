import { NextResponse } from "next/server";

import { getStripe } from "@/server/stripe";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit, getRateLimitFailure } from "@/server/rate-limit";

type CheckoutBody = {
  plan?: "free" | "pro" | "team";
};

function isStripePermissionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { type?: unknown; statusCode?: unknown };
  return maybe.type === "StripePermissionError" || maybe.statusCode === 403;
}

const PLAN_TO_PRICE_ENVS: Record<NonNullable<CheckoutBody["plan"]>, string[]> = {
  free: ["STRIPE_PRICE_ID_FREE"],
  // Compatibility with Vercel Stripe integrations that provide "basic/premium" plan ids.
  pro: ["STRIPE_PRICE_ID_PRO", "STRIPE_BASIC_MONTHLY_PRICE_ID"],
  team: ["STRIPE_PRICE_ID_TEAM", "STRIPE_PREMIUM_MONTHLY_PRICE_ID"],
};

export async function POST(request: Request) {
  const authSession = await getAuthSession();
  const userId = authSession?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rate = await checkRateLimit("stripe", `user:${userId}`);
  const rateFailure = getRateLimitFailure(
    rate,
    "Too many billing attempts. Please wait a bit and try again.",
  );
  if (rateFailure) {
    return NextResponse.json(rateFailure.body, {
      status: rateFailure.status,
      headers: rateFailure.headers,
    });
  }

  const payload = (await request.json().catch(() => ({}))) as CheckoutBody;
  const plan = payload.plan ?? "pro";
  const priceEnvCandidates = PLAN_TO_PRICE_ENVS[plan];
  const resolvedPriceEnv = priceEnvCandidates.find((envName) => Boolean(process.env[envName]));
  const priceId = resolvedPriceEnv ? process.env[resolvedPriceEnv] : undefined;
  if (!priceId) {
    return NextResponse.json(
      { error: `${priceEnvCandidates.join(" or ")} is not set.` },
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

  try {
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
  } catch (err) {
    console.error("stripe_checkout_error", err);
    if (isStripePermissionError(err)) {
      return NextResponse.json(
        {
          error:
            "Billing is temporarily unavailable. The configured Stripe key is missing checkout-session write permissions.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Stripe checkout request failed." }, { status: 502 });
  }
}
