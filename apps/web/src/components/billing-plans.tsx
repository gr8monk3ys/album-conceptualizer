"use client";

import { useEffect, useState } from "react";

type PlanKey = "free" | "pro" | "team";

const PLANS: Array<{
  key: PlanKey;
  name: string;
  price: string;
  perks: string[];
}> = [
  { key: "free", name: "Free", price: "$0", perks: ["5 projects", "JSON export", "Basic track scaffolds"] },
  {
    key: "pro",
    name: "Pro",
    price: "$12",
    perks: ["Unlimited projects", "Full export bundle", "Higher credit limits"],
  },
  {
    key: "team",
    name: "Team",
    price: "$29",
    perks: ["Multiple workspaces", "Collaboration", "Admin + shared assets"],
  },
];

export function BillingPlans({
  workspaceName,
  currentPlan,
  status,
  currentPeriodEnd,
  hasCustomer,
}: {
  workspaceName: string;
  currentPlan: string;
  status: string;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}) {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [statusText, setStatusText] = useState<string>("");
  const [banner, setBanner] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextBanner =
      params.get("success") === "1"
        ? "Subscription updated. You’re all set."
        : params.get("canceled") === "1"
          ? "Checkout canceled."
          : "";
    setBanner(nextBanner);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs text-ink-3">Billing</div>
        <div className="text-2xl font-semibold tracking-tight text-ink">
          {workspaceName}: plan & billing
        </div>
        <div className="mt-2 max-w-[70ch] text-sm text-ink-2">
          Manage your subscription (Stripe). Your plan gates project limits, exports, and credits.
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-line bg-raised px-3 py-1 text-ink">
            Current: <span className="font-semibold">{currentPlan}</span>
          </span>
          <span className="rounded-full border border-line bg-sunken px-3 py-1 text-ink-2">
            Status: <span className="font-semibold text-ink">{status}</span>
          </span>
          {currentPeriodEnd ? (
            <span className="rounded-full border border-line bg-sunken px-3 py-1 text-ink-2">
              Renews:{" "}
              <span className="font-semibold text-ink">
                {new Date(currentPeriodEnd).toLocaleDateString()}
              </span>
            </span>
          ) : null}
          {hasCustomer ? (
            <button
              type="button"
              onClick={async () => {
                setStatusText("");
                try {
                  const response = await fetch("/api/stripe/portal", { method: "POST" });
                  const body = (await response.json().catch(() => null)) as
                    | { url?: string; error?: string }
                    | null;
                  if (!response.ok || !body?.url) throw new Error(body?.error || "Portal failed.");
                  window.location.href = body.url;
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Portal failed.";
                  setStatusText(message);
                }
              }}
              className="rounded-full border border-line bg-raised px-3 py-1 text-ink hover:bg-hover"
            >
              Manage in Stripe
            </button>
          ) : null}
        </div>
      </div>

      {banner ? (
        <div className="rounded-2xl border border-line-strong bg-ok-soft px-4 py-3 text-sm text-ink">
          {banner}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentPlan;
          return (
            <div
              key={plan.key}
              className="rounded-2xl border border-line bg-raised p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">{plan.name}</div>
                <div className="text-sm font-semibold text-white">{plan.price}/mo</div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-ink-2">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {perk}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isCurrent || loadingPlan === plan.key}
                onClick={async () => {
                  if (plan.key === "free") {
                    setStatusText("Downgrades/cancellations are handled in the Stripe portal.");
                    return;
                  }
                  setLoadingPlan(plan.key);
                  setStatusText("");
                  try {
                    const response = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ plan: plan.key }),
                    });
                    const body = (await response.json().catch(() => null)) as
                      | { url?: string; error?: string }
                      | null;
                    if (!response.ok || !body?.url) {
                      throw new Error(body?.error || "Checkout failed.");
                    }
                    window.location.href = body.url;
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "Checkout failed.";
                    setStatusText(message);
                  } finally {
                    setLoadingPlan(null);
                  }
                }}
                className="mt-4 w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isCurrent ? "Current plan" : loadingPlan === plan.key ? "Redirecting..." : `Choose ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {statusText ? <div className="text-sm text-ink-3">{statusText}</div> : null}
    </div>
  );
}
