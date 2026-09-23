"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

import { useAgentJob } from "@/hooks/use-agent-job";
import { parseApiError } from "@/lib/api-error";


type IdeationAiProps = {
  concept: string;
  references: string;
  themes: string;
  trackCount: number;
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

export function IdeationAi({ concept, references, themes, trackCount }: IdeationAiProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });

  async function start() {
    setIsStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/agents/ideation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          concept,
          references,
          themes,
          track_count: trackCount,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, "Could not start ideation."));
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start ideation.";
      setStartError(message);
    } finally {
      setIsStarting(false);
    }
  }

  const error = startError ?? pollError;
  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "") : "";
  const failureMessage = job?.status === "failed" ? (job.error ?? "Ideation failed.") : null;
  const hasEnoughInput = concept.trim().length > 0;

  return (
    <div className="rounded-2xl border border-accent bg-selected p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ink" />
          <div>
            <div className="text-xs text-ink-3">AI brainstorm</div>
            <div className="text-sm font-semibold text-ink">
              Generate a vision, style profile, and tracklist
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={isBusy || !hasEnoughInput}
          onClick={() => void start()}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          title={hasEnoughInput ? "Run AI ideation" : "Add an album title and concept first"}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isStarting
            ? "Starting…"
            : isPolling
              ? `Brainstorming… ${formatElapsed(elapsedMs)}`
              : job?.status === "completed"
                ? "Run again"
                : "Brainstorm with AI"}
        </button>
      </div>

      {!hasEnoughInput && !jobId ? (
        <div className="mt-2 text-xs text-ink-3">
          Fill in the foundation step first — the crew uses your concept, references, and themes.
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-2xl border border-danger bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {failureMessage ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-2xl border border-danger bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{failureMessage}</span>
        </div>
      ) : null}

      {isPolling && !output ? (
        <div
          aria-live="polite"
          className="mt-3 rounded-2xl border border-line bg-sunken px-4 py-6 text-center text-xs text-ink-2"
        >
          The crew is defining a vision, style profile, and narrative structure. This typically takes
          30-90 seconds.
        </div>
      ) : null}

      {output ? (
        <div className="mt-3 rounded-2xl border border-line bg-sunken px-4 py-3">
          <div className="whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
            {output}
          </div>
        </div>
      ) : null}
    </div>
  );
}
