/** Billing API — subscriptions, checkout, and credit balance. */
import { api, ApiClientError } from "./client";
import type { CreditBalance, Subscription } from "./types";

/** Default subscription when the endpoint does not exist yet. */
const DEFAULT_SUBSCRIPTION: Subscription = {
  id: "",
  plan: "free",
  status: "active",
  currentPeriodEnd: null,
};

/** Default credit balance when the endpoint does not exist yet. */
const DEFAULT_CREDITS: CreditBalance = { balance: 0 };

export const billingApi = {
  /**
   * Fetch current subscription.
   *
   * NOTE: The `/api/stripe/subscription` route does not exist in the backend
   * yet. We return a safe default so the billing screen does not crash.
   */
  getSubscription: async (): Promise<Subscription> => {
    try {
      return await api.get<Subscription>("/api/stripe/subscription");
    } catch (err) {
      if (err instanceof ApiClientError && err.isNotFound) {
        return DEFAULT_SUBSCRIPTION;
      }
      throw err;
    }
  },

  createCheckout: (plan: string) =>
    api.post<{ url: string }>("/api/stripe/checkout", { plan }),

  getPortalUrl: () => api.get<{ url: string }>("/api/stripe/portal"),

  /**
   * Fetch credit balance.
   *
   * NOTE: The `/api/credits` route does not exist in the backend yet.
   * We return a safe default so the billing screen does not crash.
   */
  getCredits: async (): Promise<CreditBalance> => {
    try {
      return await api.get<CreditBalance>("/api/credits");
    } catch (err) {
      if (err instanceof ApiClientError && err.isNotFound) {
        return DEFAULT_CREDITS;
      }
      throw err;
    }
  },
};
