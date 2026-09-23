import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import type { AlbumOnboardingStep, AlbumOnboardingSummary } from "@/server/onboarding";
import { cn } from "@/lib/utils";

const DISCLOSURE =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-hover";

function StepRows({
  steps,
  nextKey,
  idPrefix,
  markCurrent = false,
}: {
  steps: AlbumOnboardingStep[];
  nextKey: string | undefined;
  idPrefix: string;
  /** Only one list on the page carries `aria-current="step"`. */
  markCurrent?: boolean;
}) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {steps.map((step) => {
        const isNext = step.key === nextKey;
        const detailId = `${idPrefix}-${step.key}-detail`;
        return (
          <li key={step.key}>
            <Link
              href={step.href}
              aria-describedby={detailId}
              aria-current={isNext && markCurrent ? "step" : undefined}
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
                <span id={detailId} className="mt-0.5 block max-w-[65ch] text-xs leading-relaxed text-ink-3">
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
  );
}

/**
 * The album's "What's next": the next one or two open steps, each linking to where it gets
 * done, and the whole path behind "Show all steps". Completion is read from the album itself;
 * the blueprint is saved by the time the album exists, so it heads the list instead of
 * counting as a step.
 */
export function FirstProjectChecklist({
  summary,
  shown = 2,
}: {
  summary: AlbumOnboardingSummary;
  /** How many open steps show before the disclosure. */
  shown?: number;
}) {
  const open = summary.steps.filter((step) => !step.complete);
  const nextKey = open[0]?.key;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        Blueprint saved ·{" "}
        <span className="type-figure font-semibold text-ink">{summary.completeCount}</span> of{" "}
        <span className="type-figure">{summary.totalCount}</span> steps done
      </p>
      {open.length ? (
        <StepRows steps={open.slice(0, shown)} nextKey={nextKey} idPrefix="step-next" markCurrent />
      ) : (
        <p className="max-w-[65ch] text-sm text-ink-2">Every step is done. The album is ready to hand off.</p>
      )}
      <details>
        <summary className={DISCLOSURE}>{`Show all ${summary.totalCount} steps`}</summary>
        <div className="mt-3">
          <StepRows steps={summary.steps} nextKey={nextKey} idPrefix="step-all" />
        </div>
      </details>
    </div>
  );
}
