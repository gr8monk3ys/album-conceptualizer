"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

import { useAgentJob } from "@/hooks/use-agent-job";
import { parseApiError } from "@/lib/api-error";


type SongDevelopmentAiProps = {
  albumId: string;
  songTitle: string;
  trackNumber: number;
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

export function SongDevelopmentAi({ albumId, songTitle, trackNumber }: SongDevelopmentAiProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });

  async function start() {
    setIsStarting(true);
    setStartError(null);
    setCollapsed(false);
    try {
      const res = await fetch("/api/agents/song-development", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          album_id: albumId,
          song_title: songTitle,
          track_number: trackNumber,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, "Could not start song development."));
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start song development.";
      setStartError(message);
    } finally {
      setIsStarting(false);
    }
  }

  const error = startError ?? pollError;
  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "") : "";
  const failureMessage = job?.status === "failed" ? (job.error ?? "Song development failed.") : null;

  // Compact mode: only show the button when no output yet.
  if (!jobId && !startError) {
    return (
      <button
        type="button"
        disabled={isBusy}
        onClick={() => void start()}
        className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(109,94,252,0.3)] bg-[rgba(109,94,252,0.08)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(109,94,252,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
        title="Generate lyrics, chords, and production notes with AI"
      >
        <Sparkles className="h-4 w-4" />
        Develop with AI
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[rgba(109,94,252,0.2)] bg-[rgba(109,94,252,0.06)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--text)]" />
          <div>
            <div className="text-xs text-[var(--muted2)]">AI song development</div>
            <div className="text-sm font-semibold text-[var(--text)]">
              Track {trackNumber}: {songTitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {output ? (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[10px] font-semibold text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void start()}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isStarting
              ? "Starting…"
              : isPolling
                ? `Developing… ${formatElapsed(elapsedMs)}`
                : "Run again"}
          </button>
        </div>
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
          The crew is writing lyrics, suggesting harmony, and generating production notes. This
          typically takes 30-90 seconds.
        </div>
      ) : null}

      {output && !collapsed ? (
        <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3">
          <div className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
            {output}
          </div>
        </div>
      ) : null}
    </div>
  );
}
