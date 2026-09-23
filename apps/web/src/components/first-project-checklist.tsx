import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import type { AlbumOnboardingSummary } from "@/server/onboarding";
import { cn } from "@/lib/utils";

/**
 * The album's "What's next" list: one row per milestone, each linking to the screen where
 * it gets done. Completion is read from the album itself. Finished rows stay in place,
 * checked, so the order still reads as a path.
 */
export function FirstProjectChecklist({ summary }: { summary: AlbumOnboardingSummary }) {
  const nextKey = summary.steps.find((step) => !step.complete)?.key;

  return (
    <div>
      <p className="text-sm text-ink-2">
        <span className="type-figure font-semibold text-ink">{summary.completeCount}</span> of{" "}
        <span className="type-figure">{summary.totalCount}</span> done
      </p>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {summary.steps.map((step) => {
          const isNext = step.key === nextKey;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                aria-describedby={`step-${step.key}-detail`}
                aria-current={isNext ? "step" : undefined}
                className="group flex min-h-11 items-start gap-3 py-3 pr-1 transition-colors hover:bg-hover"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm border",
                    step.complete ? "border-ok/60 text-ok" : "border-line-strong text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn("text-sm", step.complete ? "text-ink-2" : "font-semibold text-ink")}>
                      {step.label}
                      <span className="sr-only">{step.complete ? " (done)" : " (to do)"}</span>
                    </span>
                    {isNext ? <span className="text-xs font-semibold text-ink-2">Up next</span> : null}
                  </span>
                  <span
                    id={`step-${step.key}-detail`}
                    className="mt-0.5 block max-w-[65ch] text-xs leading-relaxed text-ink-3"
                  >
                    {step.description}
                  </span>
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink motion-safe:transition-[color,transform] motion-safe:group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
