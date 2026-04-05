"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

import { useAgentJob } from "@/hooks/use-agent-job";


type CoherenceAiReviewProps = {
  albumId: string;
};

type StartJobResponse = {
  job_id: string;
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return "< 1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function CoherenceAiReview({ albumId }: CoherenceAiReviewProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });

  async function start() {
    setIsStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/agents/coherence-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album_id: albumId }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const data = (await res.json()) as { error?: unknown };
          if (typeof data?.error === "string") detail = data.error;
        } catch {
          // swallow
        }
        throw new Error(detail);
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start review.";
      setStartError(message);
    } finally {
      setIsStarting(false);
    }
  }

  const error = startError ?? pollError;
  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "") : "";
  const failureMessage = job?.status === "failed" ? (job.error ?? "Review failed.") : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(109,94,252,0.06)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--text)]" />
          <div>
            <div className="text-xs text-[var(--muted2)]">AI coherence review</div>
            <div className="text-sm font-semibold text-[var(--text)]">
              LLM-powered qualitative feedback
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void start()}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isStarting
            ? "Starting…"
            : isPolling
              ? `Reviewing… ${formatElapsed(elapsedMs)}`
              : job?.status === "completed"
                ? "Run again"
                : "Run AI review"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-2xl border border-[rgba(255,72,72,0.22)] bg-[rgba(255,72,72,0.10)] px-3 py-2 text-xs text-[var(--bad)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {failureMessage ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-2xl border border-[rgba(255,72,72,0.22)] bg-[rgba(255,72,72,0.10)] px-3 py-2 text-xs text-[var(--bad)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{failureMessage}</span>
        </div>
      ) : null}

      {isPolling && !output ? (
        <div
          aria-live="polite"
          className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-6 text-center text-xs text-[var(--muted)]"
        >
          The review crew is reading your bible and tracks. This typically takes 30-90 seconds.
        </div>
      ) : null}

      {output ? (
        <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3">
          <div className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
            {output}
          </div>
        </div>
      ) : null}

      {!jobId && !startError ? (
        <div className="mt-3 text-xs text-[var(--muted2)]">
          Run an LLM-powered coherence review on top of the rule-based report above. Uses your
          album bible and tracks.
        </div>
      ) : null}
    </div>
  );
}
