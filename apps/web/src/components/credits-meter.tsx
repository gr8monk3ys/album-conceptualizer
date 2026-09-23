import Link from "next/link";

import { CREDIT_COSTS } from "@/lib/credit-costs";

/** The workspace's credit balance, with what it is for and where to get more. */
export function CreditsMeter({ credits }: { credits?: { remaining: number; total: number } }) {
  const remaining = credits?.remaining ?? 0;
  const total = credits?.total ?? 0;
  const ratio = total ? Math.min(1, remaining / total) : 0;
  return (
    <div className="px-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-2">Credits</span>
        <span className="type-figure font-semibold text-ink">
          {remaining}
          <span className="font-normal text-ink-3"> / {total}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label="Credits"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={remaining}
        aria-valuetext={`${remaining} of ${total} monthly credits left`}
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-ink-2" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        Creating an album costs {CREDIT_COSTS.albumCreate}, a remix {CREDIT_COSTS.albumFork}, an export{" "}
        {CREDIT_COSTS.exportZip} and an AI run {CREDIT_COSTS.agentRun}. Refills monthly;{" "}
        <Link href="/app/challenges" className="text-ink-2 underline hover:text-ink">
          challenges
        </Link>{" "}
        add more.
      </p>
    </div>
  );
}
