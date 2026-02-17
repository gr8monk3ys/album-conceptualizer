/** Billing API — subscriptions, checkout, and credit balance. */
import { api } from "./client";
import type { CreditBalance, Subscription } from "./types";

export const billingApi = {
  getSubscription: () => api.get<Subscription>("/api/stripe/subscription"),

  createCheckout: (plan: string) =>
    api.post<{ url: string }>("/api/stripe/checkout", { plan }),

  getPortalUrl: () => api.get<{ url: string }>("/api/stripe/portal"),

  getCredits: () => api.get<CreditBalance>("/api/credits"),
};
