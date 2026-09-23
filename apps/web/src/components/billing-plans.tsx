"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";

import { Button, Chip, PageHeader, Section, StatusMessage } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { cn } from "@/lib/utils";

type PlanKey = "free" | "pro" | "team";

const PLANS: Array<{ key: PlanKey; name: string; price: string; rank: number }> = [
  { key: "free", name: "Free", price: "$0", rank: 0 },
  { key: "pro", name: "Pro", price: "$12", rank: 1 },
  { key: "team", name: "Team", price: "$29", rank: 2 },
];

const PLAN_NAME: Record<string, string> = { free: "Free", pro: "Pro", team: "Team" };

const noopSubscribe = () => () => {};

/** A date in the viewer's locale once on the client; the ISO day during server render. */
function useLocalDate(iso: string | null) {
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!iso) return null;
  if (!onClient) return iso.slice(0, 10);
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** The subscription's state in plain words. */
function statusWords(status: string, periodEnd: string | null, date: string | null) {
  const future = periodEnd ? new Date(periodEnd).getTime() > Date.now() : false;
  switch (status) {
    case "active":
      return date ? `Active · renews ${date}` : "Active";
    case "trialing":
      return date ? `Trial · ends ${date}` : "Trial";
    case "past_due":
      return "Payment overdue. Update your card in Manage billing to keep your plan.";
    case "canceled":
      return date ? `Canceled — ${future ? "ends" : "ended"} ${date}` : "Canceled";
    case "unpaid":
      return "Unpaid. Your paid plan is paused until a payment goes through.";
    case "incomplete":
    case "incomplete_expired":
      return "Payment not completed. Choose a plan again to retry.";
    default:
      return "No subscription";
  }
}

export function BillingPlans({
  workspaceName,
  currentPlan,
  subscribedPlan,
  status,
  currentPeriodEnd,
  hasCustomer,
  monthlyCredits,
  freeProjectLimit,
}: {
  workspaceName: string;
  /** The plan whose entitlements apply right now. */
  currentPlan: PlanKey;
  /** The plan on the subscription record, which may no longer be in effect. */
  subscribedPlan: string;
  status: string;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  monthlyCredits: Record<PlanKey, number>;
  freeProjectLimit: number;
}) {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "ok" | "neutral"; text: string } | null>(null);
  const periodDate = useLocalDate(currentPeriodEnd);
  const currentRank = PLANS.find((plan) => plan.key === currentPlan)?.rank ?? 0;
  const recommended = PLANS.find((plan) => plan.rank === currentRank + 1)?.key ?? null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      setBanner({ tone: "ok", text: "Your plan is updated. New credits are in your balance." });
    } else if (params.get("canceled") === "1") {
      setBanner({ tone: "neutral", text: "Checkout canceled. Nothing was charged." });
    }
  }, []);

  async function openPortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error || "Billing management couldn't open. Try again in a moment.");
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing management couldn't open. Try again in a moment.");
      setPortalLoading(false);
    }
  }

  async function checkout(plan: PlanKey) {
    setLoadingPlan(plan);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error || "Checkout couldn't start. Try again in a moment.");
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout couldn't start. Try again in a moment.");
      setLoadingPlan(null);
    }
  }

  const subscribedName = PLAN_NAME[subscribedPlan] ?? subscribedPlan;
  const showsSubscription = status !== "inactive" && subscribedPlan !== "free";

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Plan and billing"
        catalog={`${workspaceName} · ${PLAN_NAME[currentPlan]} plan`}
        description="Your plan sets how many albums you can keep and how many credits arrive each month. Payments are handled by Stripe."
        actions={
          hasCustomer ? (
            <Button tone="secondary" onClick={openPortal} disabled={portalLoading}>
              {portalLoading ? "Opening…" : "Manage billing"}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-1 gap-y-3 border-y border-line py-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          <dt className="type-catalog text-xs text-ink-2">Plan in effect</dt>
          <dd className="text-sm font-semibold text-ink">{PLAN_NAME[currentPlan]}</dd>
          <dt className="type-catalog text-xs text-ink-2">Subscription</dt>
          <dd className="text-sm text-ink">
            {showsSubscription
              ? `${subscribedName}: ${statusWords(status, currentPeriodEnd, periodDate)}`
              : "No subscription. You're on Free."}
          </dd>
        </dl>
        {banner ? <StatusMessage tone={banner.tone}>{banner.text}</StatusMessage> : null}
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      </div>

      <Section id="plans" title="Compare plans">
        <ul className="grid grid-cols-1 divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const facts = [
              plan.key === "free" ? `Up to ${freeProjectLimit} albums` : "Unlimited albums",
              `${monthlyCredits[plan.key]} credits each month`,
              "Studio, Album Bible, coherence report and exports",
            ];
            return (
              <li
                key={plan.key}
                aria-labelledby={`plan-${plan.key}`}
                className={cn("flex min-w-0 flex-col gap-4 p-5", isCurrent && "bg-selected")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`plan-${plan.key}`} className="type-display text-2xl text-ink">
                    {plan.name}
                  </h3>
                  {isCurrent ? <Chip>Current plan</Chip> : null}
                </div>
                <p className="text-ink">
                  <span className="type-figure text-3xl font-semibold">{plan.price}</span>
                  <span className="text-sm text-ink-2"> a month</span>
                </p>
                <ul className="flex flex-col gap-2 text-sm text-ink-2">
                  {facts.map((fact) => (
                    <li key={fact} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                      {fact}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <p className="text-sm font-medium text-ink">You&apos;re on this plan.</p>
                  ) : plan.key === "free" ? (
                    <p className="text-sm text-ink-2">
                      {hasCustomer
                        ? "To move to Free, cancel your subscription from Manage billing."
                        : "Free is always available."}
                    </p>
                  ) : (
                    <Button
                      tone={plan.key === recommended ? "primary" : "secondary"}
                      className="w-full"
                      disabled={loadingPlan !== null}
                      onClick={() => checkout(plan.key)}
                    >
                      {loadingPlan === plan.key
                        ? "Opening checkout…"
                        : `${plan.rank > currentRank ? "Upgrade to" : "Switch to"} ${plan.name}`}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        id="credits"
        title="What credits pay for"
        description="Writing, saving and reading your Album Bible are always free. These actions spend credits:"
      >
        <dl className="max-w-md">
          {[
            { label: "Create an album", cost: CREDIT_COSTS.albumCreate },
            { label: "Remix an album from Discover", cost: CREDIT_COSTS.albumFork },
            { label: "Download the zip export", cost: CREDIT_COSTS.exportZip },
            { label: "Run an agent workflow", cost: CREDIT_COSTS.agentRun },
          ].map((use) => (
            <div key={use.label} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
              <dt className="text-sm text-ink-2">{use.label}</dt>
              <dd className="type-figure shrink-0 text-sm font-semibold text-ink">{use.cost} credits</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-2">
          Each calendar month your plan tops your balance up to its monthly amount. Need a few more?{" "}
          <Link href="/app/challenges" className="inline-flex min-h-11 items-center text-ink underline underline-offset-4">
            Daily challenges earn credits
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
