import Link from "next/link";

/** The workspace's credit balance and where to get more. What things cost is on each button and in Help. */
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
        aria-valuemax={Math.max(total, remaining)}
        aria-valuenow={remaining}
        aria-valuetext={`${remaining} of ${total} monthly credits left`}
        // Forced colors drop both washes, so there the track is drawn as a CanvasText outline
        // and the fill in CanvasText, and the meter still reads.
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line forced-colors:border forced-colors:border-[CanvasText]"
      >
        <div
          className="h-full rounded-full bg-ink-2 forced-colors:bg-[CanvasText]"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      {/* No price list here: each priced button names its cost and Help lists them all, so the
          meter stays a balance and a way to earn more. */}
      <Link
        href="/app/challenges"
        className="mt-1 inline-flex min-h-11 items-center text-xs text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
      >
        Earn more with daily challenges
      </Link>
    </div>
  );
}
