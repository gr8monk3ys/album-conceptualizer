import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getPrisma } from "@/server/db";

// The Stripe checkout and webhook routes with a mocked Stripe client and the caller's
// workspace stubbed; the Subscription rows run against the Postgres in DATABASE_URL.
const caller = vi.hoisted(() => ({ userId: "", workspaceId: "" }));
const stripe = vi.hoisted(() => ({
  // What stripe.subscriptions.retrieve returns: Stripe's current state, by subscription id.
  live: new Map<string, unknown>(),
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
}));

vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: caller.userId, workspaceId: caller.workspaceId, plan: "free" }),
    enforceRateLimit: async () => ({}),
  };
});
vi.mock("@/server/auth", () => ({
  getAuthSession: async () => ({ user: { id: caller.userId, email: "payer@test.local" } }),
}));
vi.mock("@/server/analytics", () => ({ trackProductEventSafe: async () => {} }));
vi.mock("@/server/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/stripe")>();
  return { ...actual, requireStripe: () => stripe };
});

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PRICE = { pro: "price_pro_test", team: "price_team_test" } as const;

function subscription(
  id: string,
  status: string,
  plan: "pro" | "team",
  opts: { workspaceId?: string; customer?: string; periodEnd?: number } = {},
) {
  return {
    id,
    object: "subscription",
    status,
    customer: opts.customer ?? "cus_test",
    metadata: opts.workspaceId ? { workspaceId: opts.workspaceId } : {},
    items: {
      data: [{ price: { id: PRICE[plan] }, current_period_end: opts.periodEnd ?? 1_900_000_000 }],
    },
  };
}

describe.skipIf(!hasDatabase)("Stripe billing routes (database, mocked Stripe)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.STRIPE_PRICE_ID_PRO = PRICE.pro;
    process.env.STRIPE_PRICE_ID_TEAM = PRICE.team;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    stripe.live.clear();
    stripe.checkout.sessions.create.mockResolvedValue({ id: "cs_new", url: "https://checkout.test/cs_new" });
    stripe.billingPortal.sessions.create.mockResolvedValue({ url: "https://portal.test/session" });
    stripe.subscriptions.retrieve.mockImplementation(async (id: string) => {
      const live = stripe.live.get(id);
      if (!live) throw Object.assign(new Error(`No such subscription: ${id}`), { type: "StripeInvalidRequestError" });
      return live;
    });
    stripe.webhooks.constructEvent.mockImplementation((body: string) => JSON.parse(body));

    const user = await prisma.user.create({ data: { email: `stripebilling-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Billing", ownerId: user.id } });
    caller.userId = user.id;
    caller.workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "stripebilling-" } } });
  });

  const storeSubscription = (data: {
    plan: string;
    status: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
  }) => prisma.subscription.create({ data: { workspaceId: caller.workspaceId, ...data } });

  const storedSubscription = () =>
    prisma.subscription.findUnique({
      where: { workspaceId: caller.workspaceId },
      select: { plan: true, status: true, stripeSubscriptionId: true, stripeCustomerId: true },
    });

  async function checkout(plan: "pro" | "team") {
    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      }),
      undefined as never,
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function deliver(type: string, object: unknown) {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=test" },
        body: JSON.stringify({ id: `evt_${crypto.randomUUID()}`, type, data: { object } }),
      }),
      undefined as never,
    );
    return response.status;
  }

  describe("checkout", () => {
    it("sends a paying workspace's plan change to the billing portal, never a second checkout", async () => {
      await storeSubscription({ plan: "pro", status: "active", stripeSubscriptionId: "sub_pro", stripeCustomerId: "cus_pro" });

      const result = await checkout("team");

      expect(result.status).toBe(200);
      expect(result.body.url).toBe("https://portal.test/session");
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_pro",
          flow_data: expect.objectContaining({
            type: "subscription_update",
            subscription_update: { subscription: "sub_pro" },
          }),
        }),
      );
    });

    it("treats trialing and past_due subscriptions as paying too", async () => {
      await storeSubscription({ plan: "team", status: "past_due", stripeSubscriptionId: "sub_team", stripeCustomerId: "cus_team" });
      expect((await checkout("pro")).body.url).toBe("https://portal.test/session");

      await prisma.subscription.update({ where: { workspaceId: caller.workspaceId }, data: { status: "trialing" } });
      expect((await checkout("pro")).body.url).toBe("https://portal.test/session");
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("opens the portal's home page when the portal can't change plans", async () => {
      await storeSubscription({ plan: "pro", status: "active", stripeSubscriptionId: "sub_pro", stripeCustomerId: "cus_pro" });
      stripe.billingPortal.sessions.create
        .mockRejectedValueOnce(Object.assign(new Error("subscription updates are disabled"), { type: "StripeInvalidRequestError" }))
        .mockResolvedValueOnce({ url: "https://portal.test/home" });

      const result = await checkout("team");

      expect(result.body.url).toBe("https://portal.test/home");
      expect(stripe.billingPortal.sessions.create).toHaveBeenLastCalledWith({
        customer: "cus_pro",
        return_url: expect.stringContaining("/app/settings/billing"),
      });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("reuses the stored Stripe customer when a lapsed workspace subscribes again", async () => {
      await storeSubscription({ plan: "pro", status: "canceled", stripeSubscriptionId: "sub_old", stripeCustomerId: "cus_old" });

      const result = await checkout("team");

      expect(result.body.url).toBe("https://checkout.test/cs_new");
      const params = stripe.checkout.sessions.create.mock.calls[0][0];
      expect(params.customer).toBe("cus_old");
      expect(params).not.toHaveProperty("customer_email");
      expect(params.line_items).toEqual([{ price: PRICE.team, quantity: 1 }]);
    });

    it("starts a first checkout with the payer's email", async () => {
      const result = await checkout("pro");

      expect(result.body.url).toBe("https://checkout.test/cs_new");
      const params = stripe.checkout.sessions.create.mock.calls[0][0];
      expect(params.customer_email).toBe("payer@test.local");
      expect(params).not.toHaveProperty("customer");
    });
  });

  describe("webhook", () => {
    it("syncs Stripe's current state, not a stale event payload", async () => {
      // "updated" (active) was processed first; the delayed "created" still says incomplete.
      await storeSubscription({ plan: "team", status: "active", stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1" });
      stripe.live.set("sub_1", subscription("sub_1", "active", "team", { workspaceId: caller.workspaceId, customer: "cus_1" }));

      const status = await deliver(
        "customer.subscription.created",
        subscription("sub_1", "incomplete", "team", { workspaceId: caller.workspaceId, customer: "cus_1" }),
      );

      expect(status).toBe(200);
      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
      expect(await storedSubscription()).toMatchObject({ plan: "team", status: "active", stripeSubscriptionId: "sub_1" });
    });

    it("ignores a renewal of another subscription while the current one is paying", async () => {
      await storeSubscription({ plan: "team", status: "active", stripeSubscriptionId: "sub_team", stripeCustomerId: "cus_team" });
      const old = subscription("sub_pro", "active", "pro", { workspaceId: caller.workspaceId, customer: "cus_pro" });
      stripe.live.set("sub_pro", old);

      expect(await deliver("customer.subscription.updated", old)).toBe(200);

      expect(await storedSubscription()).toEqual({
        plan: "team",
        status: "active",
        stripeSubscriptionId: "sub_team",
        stripeCustomerId: "cus_team",
      });
    });

    it("ignores a second checkout's subscription while the current one is paying", async () => {
      await storeSubscription({ plan: "pro", status: "active", stripeSubscriptionId: "sub_pro", stripeCustomerId: "cus_pro" });
      stripe.live.set("sub_dup", subscription("sub_dup", "active", "team", { workspaceId: caller.workspaceId, customer: "cus_dup" }));

      const status = await deliver("checkout.session.completed", {
        id: "cs_dup",
        client_reference_id: caller.workspaceId,
        subscription: "sub_dup",
        customer: "cus_dup",
        metadata: { workspaceId: caller.workspaceId },
      });

      expect(status).toBe(200);
      expect(await storedSubscription()).toMatchObject({ plan: "pro", stripeSubscriptionId: "sub_pro", stripeCustomerId: "cus_pro" });
    });

    it("lets a new subscription replace a canceled one", async () => {
      await storeSubscription({ plan: "pro", status: "canceled", stripeSubscriptionId: "sub_old", stripeCustomerId: "cus_old" });
      const next = subscription("sub_new", "active", "team", { workspaceId: caller.workspaceId, customer: "cus_new" });
      stripe.live.set("sub_new", next);

      expect(await deliver("customer.subscription.created", next)).toBe(200);

      expect(await storedSubscription()).toEqual({
        plan: "team",
        status: "active",
        stripeSubscriptionId: "sub_new",
        stripeCustomerId: "cus_new",
      });
    });

    it("keeps the new subscription when the old one's cancellation arrives late", async () => {
      await storeSubscription({ plan: "team", status: "active", stripeSubscriptionId: "sub_new", stripeCustomerId: "cus_new" });
      const old = subscription("sub_old", "canceled", "pro", { workspaceId: caller.workspaceId, customer: "cus_old" });
      stripe.live.set("sub_old", old);

      expect(await deliver("customer.subscription.deleted", old)).toBe(200);

      expect(await storedSubscription()).toMatchObject({ plan: "team", status: "active", stripeSubscriptionId: "sub_new" });
    });

    it("records the first subscription from checkout, with its customer", async () => {
      stripe.live.set("sub_first", subscription("sub_first", "active", "pro", { workspaceId: caller.workspaceId, customer: "cus_first" }));

      const status = await deliver("checkout.session.completed", {
        id: "cs_first",
        client_reference_id: caller.workspaceId,
        subscription: "sub_first",
        customer: "cus_first",
        metadata: { workspaceId: caller.workspaceId },
      });

      expect(status).toBe(200);
      expect(await storedSubscription()).toEqual({
        plan: "pro",
        status: "active",
        stripeSubscriptionId: "sub_first",
        stripeCustomerId: "cus_first",
      });
    });

    it("applies the current subscription's cancellation", async () => {
      await storeSubscription({ plan: "pro", status: "active", stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1" });
      const canceled = subscription("sub_1", "canceled", "pro", { workspaceId: caller.workspaceId, customer: "cus_1" });
      stripe.live.set("sub_1", canceled);

      expect(await deliver("customer.subscription.deleted", canceled)).toBe(200);

      expect(await storedSubscription()).toMatchObject({ plan: "pro", status: "canceled", stripeSubscriptionId: "sub_1" });
    });

    it("updates a subscription without workspace metadata by its id", async () => {
      await storeSubscription({ plan: "pro", status: "active", stripeSubscriptionId: "sub_legacy", stripeCustomerId: "cus_1" });
      const upgraded = subscription("sub_legacy", "active", "team", { customer: "cus_1" });
      stripe.live.set("sub_legacy", upgraded);

      expect(await deliver("customer.subscription.updated", subscription("sub_legacy", "active", "pro"))).toBe(200);

      expect(await storedSubscription()).toMatchObject({ plan: "team", status: "active", stripeSubscriptionId: "sub_legacy" });
    });
  });
});
