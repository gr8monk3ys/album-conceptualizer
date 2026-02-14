import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { getStripe } from "@/server/stripe";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST() {
  const authSession = await getAuthSession();
  const userId = authSession?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rate = await checkRateLimit("stripe", `user:${userId}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many billing attempts. Please wait a bit and try again." },
      { status: 429, headers: getRateLimitHeaders(rate) },
    );
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
  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/app/settings/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
