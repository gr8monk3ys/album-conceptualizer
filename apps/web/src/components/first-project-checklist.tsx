"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

import type { AlbumNextStep } from "@/server/album-songs";
import type { AlbumOnboardingStep, AlbumOnboardingSummary } from "@/server/onboarding";
import { cn } from "@/lib/utils";

const DISCLOSURE =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-hover";

function StepRows({ steps, idPrefix }: { steps: AlbumOnboardingStep[]; idPrefix: string }) {
  return (
    <ul className="@container divide-y divide-line border-y border-line">
      {steps.map((step) => {
        const detailId = `${idPrefix}-${step.key}-detail`;
        return (
          <li key={step.key}>
            <Link
              href={step.href}
              aria-describedby={detailId}
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
              <span className="min-w-0 flex-1 wrap-break-word">
                <span className={cn("text-sm", step.complete ? "text-ink-2" : "font-semibold text-ink")}>
                  {step.label}
                  <span className="sr-only">{step.complete ? " (done)" : " (to do)"}</span>
                </span>
                <span id={detailId} className="mt-0.5 block max-w-[65ch] text-xs leading-relaxed text-ink-3">
                  {step.description}
                </span>
              </span>
              <ArrowRight
                className="mt-0.5 hidden h-4 w-4 shrink-0 text-ink-3 @[12rem]:block transition-colors group-hover:text-ink motion-safe:transition-[color,transform] motion-safe:group-hover:translate-x-0.5"
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
 * The album's "What's next": ONE next step, the same one the release header's button takes
 * (`nextAlbumStep`), so the Overview never offers two different "next" things. The whole path
 * from blueprint to handoff sits behind "Show all 7 steps" ("Hide the steps" while open, and
 * its expanded state said), each step ticked from the album
 * itself; the blueprint is saved by the time the album exists, so it heads the list instead of
 * counting as a step.
 */
export function FirstProjectChecklist({
  summary,
  step,
}: {
  summary: AlbumOnboardingSummary;
  /** The album's next step, stated; left out where a banner above already says it. */
  step?: Pick<AlbumNextStep, "statement" | "trackTitle"> | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {step ? (
        <p className="max-w-[65ch] break-words text-base text-ink">
          {step.statement}
          {step.trackTitle ? <span className="text-ink-2">{` · “${step.trackTitle}”`}</span> : null}
        </p>
      ) : null}
      <p className="text-sm text-ink-2">
        Blueprint saved ·{" "}
        <span className="type-figure font-semibold text-ink">{summary.completeCount}</span> of{" "}
        <span className="type-figure">{summary.totalCount}</span> steps done
      </p>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className={DISCLOSURE} aria-expanded={open}>
          {open ? "Hide the steps" : `Show all ${summary.totalCount} steps`}
        </summary>
        <div className="mt-3">
          <StepRows steps={summary.steps} idPrefix="step-all" />
        </div>
      </details>
    </div>
  );
}
