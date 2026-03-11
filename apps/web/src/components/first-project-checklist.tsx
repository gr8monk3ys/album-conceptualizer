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
    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">First project</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text)]">
            {title ? `${title}: next milestones` : "Next milestones"}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {summary.completeCount} of {summary.totalCount} complete
          </div>
        </div>
        <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
          {percent}%
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {summary.steps.map((step, index) => (
          <Link
            key={step.key}
            href={step.href}
            className="group flex items-start gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-3 hover:bg-[rgba(255,255,255,0.05)]"
          >
            <div className="mt-0.5">
              {step.complete ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--ok)]" />
              ) : (
                <CircleDashed className="h-4 w-4 text-[var(--muted2)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted2)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold text-[var(--text)]">{step.label}</span>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                {step.description}
              </div>
            </div>
            <ArrowRight className="mt-0.5 h-4 w-4 text-[var(--muted2)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
