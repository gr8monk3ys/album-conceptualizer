"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { readApiError } from "@/components/studio/studio-model";
import { Button } from "@/components/ui";
import { useAgentJob } from "@/hooks/use-agent-job";
import { CREDIT_COSTS } from "@/lib/credit-costs";

type SongDevelopmentAiProps = {
  albumId: string;
  songTitle: string;
  trackNumber: number;
};

type StartJobResponse = {
  job_id: string;
};

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const COST: number = CREDIT_COSTS.agentRun;
const COST_LABEL = `${COST} ${COST === 1 ? "credit" : "credits"}`;

/**
 * Drafts lyrics, harmony ideas and production notes for one track. The draft is shown for the
 * artist to read and copy from; nothing in the Studio is changed by it.
 */
export function SongDevelopmentAi({ albumId, songTitle, trackNumber }: SongDevelopmentAiProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });

  async function start() {
    setIsStarting(true);
    setStartError(null);
    setExpanded(true);
    try {
      const res = await fetch("/api/agents/song-development", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album_id: albumId, song_title: songTitle, track_number: trackNumber }),
      });
      if (!res.ok) {
        const fallback = "Couldn't start the draft. No credits were spent; try again in a moment.";
        // Credit, rate-limit and sign-in problems carry a message written for the artist.
        const human = res.status === 401 || res.status === 402 || res.status === 429;
        throw new Error(human ? await readApiError(res, fallback) : fallback);
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Couldn't start the draft. Try again.");
    } finally {
      setIsStarting(false);
    }
  }

  const error = startError ?? pollError;
  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "") : "";
  const failed = job?.status === "failed";
  const outputId = `song-ai-output-${trackNumber}`;

  const buttonLabel = isStarting
    ? "Starting…"
    : isPolling
      ? `Drafting… ${formatElapsed(elapsedMs)}`
      : output
        ? `Draft again · ${COST_LABEL}`
        : `Develop with AI · ${COST_LABEL}`;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button tone="secondary" disabled={isBusy} onClick={() => void start()}>
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {buttonLabel}
        </Button>
        <p className="min-w-0 flex-1 basis-60 text-sm leading-relaxed text-ink-2">
          Drafts lyrics, harmony ideas and production notes for this track from the album’s concept.
          It takes about a minute, and nothing here changes until you copy lines in.
        </p>
      </div>

      <div>
      <div role="status" className="text-sm text-ink-2">
        {isPolling && !output
          ? "Writing lyrics, suggesting harmony and drafting production notes. This usually takes 30 to 90 seconds."
          : output
            ? "Draft ready."
            : ""}
      </div>
      <div role="alert" className="text-sm text-danger">
        {error ?? (failed ? "The draft couldn't be finished. Try again in a moment." : "")}
      </div>
      </div>

      {output ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">
              Draft for track {trackNumber}: {songTitle}
            </p>
            <Button tone="ghost" aria-expanded={expanded} aria-controls={outputId} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide draft" : "Show draft"}
            </Button>
          </div>
          {expanded ? (
            <div
              id={outputId}
              className="max-h-96 overflow-auto rounded border border-line bg-sunken px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-2"
            >
              {output}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
