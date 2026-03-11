import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { getStripe } from "@/server/stripe";
import { checkRateLimit, getRateLimitFailure } from "@/server/rate-limit";

export const runtime = "nodejs";

function isStripePermissionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { type?: unknown; statusCode?: unknown };
  return maybe.type === "StripePermissionError" || maybe.statusCode === 403;
}

export async function POST() {
  const authSession = await getAuthSession();
  const userId = authSession?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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

  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const subscription = await prisma.subscription.findUnique({
    where: { workspaceId: workspace.id },
    select: { stripeCustomerId: true },
  });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer found for this workspace yet." },
      { status: 400 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/app/settings/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("stripe_portal_error", err);
    if (isStripePermissionError(err)) {
      return NextResponse.json(
        {
          error:
            "Billing portal is temporarily unavailable. The configured Stripe key is missing billing-portal permissions.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Stripe portal request failed." }, { status: 502 });
  }
}
