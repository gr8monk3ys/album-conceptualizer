import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe() {
  if (stripeSingleton) return stripeSingleton;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    // Don't fail module evaluation (e.g. during Next build); fail only if used.
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  stripeSingleton = new Stripe(secretKey, {
    // Keep the Stripe SDK types happy (they only reflect the latest API version).
    apiVersion: Stripe.API_VERSION as Stripe.LatestApiVersion,
  });

  return stripeSingleton;
}

