import Link from "next/link";

import { readCreditMeter } from "@/lib/credit-meter";

/** The workspace's credit balance and where to get more. What things cost is on each button and in Help. */
export function CreditsMeter({ credits }: { credits?: { remaining: number; total: number } }) {
  // Never "53 / 50": a balance above the monthly grant reads "50 monthly + 3 extra" and the
  // meter stops at full (lib/credit-meter).
  const { remaining, total, extra, ratio, caption, valueText } = readCreditMeter(credits);
  return (
    <div className="px-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="text-ink-2">Credits</span>
        <span className="type-figure min-w-0 font-semibold text-ink">
          {remaining}
          {extra ? null : <span className="font-normal text-ink-3"> {caption}</span>}
        </span>
      </div>
      {extra ? <p className="type-figure mt-0.5 text-right text-xs text-ink-3">{caption}</p> : null}
      <div
        role="meter"
        aria-label="Credits"
        aria-valuemin={0}
        // The value is the balance itself (e2e and assistive tech read it); above the grant the
        // max is the balance, so the meter is full, and the text names the split.
        aria-valuemax={Math.max(total, remaining)}
        aria-valuenow={remaining}
        aria-valuetext={valueText}
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
