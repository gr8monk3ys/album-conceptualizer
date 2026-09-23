import Stripe from "stripe";

import { ApiError } from "@/server/api-error";

export type PaidPlan = "pro" | "team";

// Price ids per plan, in lookup order. The second name of each pair keeps compatibility with
// Vercel's Stripe integration, which provisions "basic/premium" price ids.
const PLAN_PRICE_ENVS: Record<PaidPlan, string[]> = {
  pro: ["STRIPE_PRICE_ID_PRO", "STRIPE_BASIC_MONTHLY_PRICE_ID"],
  team: ["STRIPE_PRICE_ID_TEAM", "STRIPE_PREMIUM_MONTHLY_PRICE_ID"],
};

let stripeSingleton: Stripe | null = null;

/** The Stripe client, or a 503 when Stripe is not configured. */
export function requireStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new ApiError(503, "Billing is not configured (STRIPE_SECRET_KEY is not set).");
  stripeSingleton = new Stripe(secretKey, {
    // Keep the Stripe SDK types happy (they only reflect the latest API version).
    apiVersion: Stripe.API_VERSION as Stripe.LatestApiVersion,
  });
  return stripeSingleton;
}

/** The Stripe price id for a paid plan, or a 503 naming the missing variable. */
export function priceForPlan(plan: PaidPlan): string {
  const envs = PLAN_PRICE_ENVS[plan];
  const priceId = envs.map((name) => process.env[name]).find(Boolean);
  if (!priceId) throw new ApiError(503, `Billing is not configured (${envs.join(" or ")} is not set).`);
  return priceId;
}

/** The plan a Stripe price id belongs to, or null for a price this app doesn't sell. */
export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PLAN_PRICE_ENVS) as PaidPlan[]) {
    if (PLAN_PRICE_ENVS[plan].some((name) => process.env[name] === priceId)) return plan;
  }
  return null;
}

/** Translate a failed Stripe API call into the ApiError a billing route should return. */
export function stripeFailure(err: unknown, action: "checkout" | "portal"): ApiError {
  console.error(`stripe_${action}_error`, err);
  const maybe = (err ?? {}) as { type?: unknown; statusCode?: unknown };
  if (maybe.type === "StripePermissionError" || maybe.statusCode === 403) {
    return new ApiError(
      503,
      action === "checkout"
        ? "Billing is temporarily unavailable. The configured Stripe key is missing checkout-session write permissions."
        : "Billing portal is temporarily unavailable. The configured Stripe key is missing billing-portal permissions.",
    );
  }
  return new ApiError(502, action === "checkout" ? "Stripe checkout request failed." : "Stripe portal request failed.");
}
