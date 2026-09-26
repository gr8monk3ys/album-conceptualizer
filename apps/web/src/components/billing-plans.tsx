"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";

import { CatalogItems } from "@/components/album-card";
import { Button, Chip, LiveStatus, PageHeader, Section, TableScroller } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { creditUses } from "@/lib/credit-uses";
import { cn } from "@/lib/utils";

type PlanKey = "free" | "pro" | "team";

const PLANS: Array<{ key: PlanKey; name: string; price: string; rank: number }> = [
  { key: "free", name: "Free", price: "$0", rank: 0 },
  { key: "pro", name: "Pro", price: "$12", rank: 1 },
  { key: "team", name: "Team", price: "$29", rank: 2 },
];

const PLAN_NAME: Record<string, string> = { free: "Free", pro: "Pro", team: "Team" };

function times(credits: number, cost: number) {
  return Math.floor(credits / cost);
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

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
  aiAvailable,
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
  /** From `getAgentAvailability()` on the server: false when AI drafts can't run here. */
  aiAvailable: boolean;
}) {
  const { albumPass, uses } = creditUses(aiAvailable);
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
        size="page"
        catalog={
          <span className="flex flex-wrap gap-x-2 gap-y-0.5">
            <CatalogItems items={[workspaceName, `${PLAN_NAME[currentPlan]} plan`]} />
          </span>
        }
        description="Your plan sets how many albums you can keep and how many credits arrive each month. Payments are handled by Stripe."
        actions={
          hasCustomer ? (
            <Button tone="secondary" onClick={openPortal} busy={portalLoading}>
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
        {/* One live region, mounted empty: the arrival from checkout, or what went wrong. */}
        <LiveStatus message={error ?? banner?.text ?? null} tone={error ? "danger" : banner?.tone} />
      </div>

      <Section
        id="plans"
        title="Compare plans"
        description="Every plan includes the Studio, the Album Bible, the Coherence report and every export format."
      >
        {/* Rem-sized container query: with enlarged text the three plans stack instead of squeezing. */}
        <div className="@container">
          <ul className="grid grid-cols-1 divide-y divide-line border-y border-line @3xl:grid-cols-3 @3xl:divide-x @3xl:divide-y-0">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              const credits = monthlyCredits[plan.key];
              // Plain facts: what the plan keeps and what arrives. What an album costs is said
              // once, under the plans, rather than as a per-plan "about N albums" headline.
              const facts = [
                plan.key === "free" ? `Keep up to ${freeProjectLimit} albums` : "Keep as many albums as you like",
                `${credits} credits each month`,
                // Offers you can't take aren't sold: without AI the plan is counted in albums.
                aiAvailable
                  ? `Enough for ${plural(times(credits, CREDIT_COSTS.agentRun), "AI draft", "AI drafts")}, or any mix of creating, remixing and exporting`
                  : `Enough to create ${plural(times(credits, CREDIT_COSTS.albumCreate), "album", "albums")}, or any mix of creating, remixing and exporting`,
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
                        <span className="min-w-0">{fact}</span>
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
                        // Busy while its own checkout opens (keeps focus); the others wait.
                        busy={loadingPlan === plan.key}
                        disabled={loadingPlan !== null && loadingPlan !== plan.key}
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
        </div>
        <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-ink-2">
          Taking one album from start to handoff (creating it,{aiAvailable ? " two AI drafts" : ""}
          {aiAvailable ? " and" : ""} a zip export) uses{" "}
          <span className="type-figure text-ink">{albumPass}</span> credits. Writing, saving, the
          Album Bible and the Coherence report never cost credits.
        </p>
        {aiAvailable ? null : (
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink-2">
            AI drafts aren&apos;t available on this server right now, so no plan includes them: its
            credits go to creating, remixing and exporting. Everything else works without them.
          </p>
        )}
      </Section>

      <Section
        id="credits"
        title="What a month of credits covers"
        description="Writing, saving, the Album Bible and the Coherence report never cost credits. These actions do; each plan column shows how many times its monthly credits cover one."
      >
        <TableScroller label="Credit costs by plan">
          <table className="w-full border-collapse text-sm">
            <caption id="credits-table-caption" className="sr-only">
              Credit cost of each action, and how many times each plan&apos;s monthly credits cover it
            </caption>
            <thead>
              <tr className="border-b border-line-strong align-bottom">
                <th scope="col" className="type-catalog min-w-[12rem] py-2 pr-4 text-left text-xs font-semibold text-ink-3">
                  Action
                </th>
                <th scope="col" className="type-catalog min-w-[6.5rem] py-2 pr-4 text-right text-xs font-semibold text-ink-3">
                  Costs
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.key}
                    scope="col"
                    className={cn(
                      // A plan column holds its name and "5000 a month · yours" on two lines at
                      // most; with less room the table scrolls in its TableScroller instead.
                      "type-catalog min-w-[8.5rem] py-2 pl-2 pr-2 text-right text-xs font-semibold",
                      plan.key === currentPlan ? "text-ink" : "text-ink-3",
                    )}
                  >
                    {plan.name}
                    <span className="type-figure block font-normal normal-case tracking-normal">
                      {monthlyCredits[plan.key]} a month
                      {plan.key === currentPlan ? " · yours" : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uses.map((use) => (
                <tr key={use.key} className="border-b border-line align-baseline">
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal text-ink-2">
                    <span className={use.detail && !use.unavailable ? "font-semibold text-ink" : undefined}>
                      {use.label}
                    </span>
                    {use.detail ? (
                      <span className="mt-0.5 block max-w-[65ch] text-xs text-ink-3">{use.detail}</span>
                    ) : null}
                  </th>
                  <td className="type-figure whitespace-nowrap py-2.5 pr-4 text-right font-semibold text-ink">
                    {use.unavailable ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Not available</span>
                      </>
                    ) : (
                      plural(use.cost, "credit", "credits")
                    )}
                  </td>
                  {PLANS.map((plan) => (
                    <td
                      key={plan.key}
                      className={cn(
                        "type-figure whitespace-nowrap py-2.5 pl-2 pr-2 text-right",
                        plan.key === currentPlan ? "text-ink" : "text-ink-2",
                      )}
                    >
                      {use.unavailable ? (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Not available on {plan.name} right now</span>
                        </>
                      ) : (
                        <>
                          {times(monthlyCredits[plan.key], use.cost)}
                          <span className="sr-only"> times on {plan.name}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
        <p className="mt-3 max-w-[65ch] text-sm text-ink-2">
          Each calendar month your plan tops your balance up to its monthly amount; credits you earn
          above that are kept. Need a few more?{" "}
          <Link href="/app/challenges" className="inline-flex min-h-11 items-center text-ink underline underline-offset-4">
            Daily challenges earn credits
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
