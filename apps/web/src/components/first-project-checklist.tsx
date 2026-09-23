import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";

import type { AlbumOnboardingSummary } from "@/server/onboarding";

export function FirstProjectChecklist({
  summary,
  title,
}: {
  summary: AlbumOnboardingSummary;
  title?: string;
}) {
  const percent = Math.round((summary.completeCount / Math.max(summary.totalCount, 1)) * 100);

  return (
    <div className="rounded-2xl border border-line bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-ink-3">First project</div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {title ? `${title}: next milestones` : "Next milestones"}
          </div>
          <div className="mt-1 text-xs text-ink-2">
            {summary.completeCount} of {summary.totalCount} complete
          </div>
        </div>
        <div className="rounded-full border border-line bg-raised px-3 py-1 text-xs font-semibold text-ink">
          {percent}%
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-hover">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {summary.steps.map((step, index) => (
          <Link
            key={step.key}
            href={step.href}
            className="group flex items-start gap-3 rounded-2xl border border-line bg-sunken px-3 py-3 hover:bg-raised"
          >
            <div className="mt-0.5">
              {step.complete ? (
                <CheckCircle2 className="h-4 w-4 text-ok" />
              ) : (
                <CircleDashed className="h-4 w-4 text-ink-3" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold text-ink">{step.label}</span>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-ink-2">
                {step.description}
              </div>
            </div>
            <ArrowRight className="mt-0.5 h-4 w-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </div>
  );
}
