"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";

import { AiUnavailableNote, useAiUnavailableNotice } from "@/components/ai-unavailable";
import { ConfirmSpend } from "@/components/confirm-spend";
import { readApiError } from "@/components/studio/studio-model";
import { Button } from "@/components/ui";
import { useAgentJob } from "@/hooks/use-agent-job";
import { CREDIT_COSTS } from "@/lib/credit-costs";

type SongDevelopmentAiProps = {
  albumId: string;
  songTitle: string;
  trackNumber: number;
  /** From `getAgentAvailability()` on the server: false when AI drafting can't run here. */
  aiAvailable: boolean;
  /** The workspace balance, so the spend confirm can say what's left after. */
  creditsRemaining?: number;
};

type StartJobResponse = {
  job_id: string;
};

/** What went wrong, and whether trying again could help. */
type Failure = { text: string; retry: "start" | "poll" | null };

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
export function SongDevelopmentAi({
  albumId,
  songTitle,
  trackNumber,
  aiAvailable,
  creditsRemaining,
}: SongDevelopmentAiProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startFailure, setStartFailure] = useState<Failure | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  // Checking on a job again re-polls it (no new job, no credits) by re-arming the hook.
  const [repollId, setRepollId] = useState<string | null>(null);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });
  const unavailable = useAiUnavailableNotice(!aiAvailable);

  useEffect(() => {
    if (!repollId) return;
    const frame = requestAnimationFrame(() => {
      setJobId(repollId);
      setRepollId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [repollId]);

  async function start() {
    if (!aiAvailable) return;
    setIsStarting(true);
    setStartFailure(null);
    setExpanded(true);
    try {
      const res = await fetch("/api/agents/song-development", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album_id: albumId, song_title: songTitle, track_number: trackNumber }),
      });
      if (!res.ok) {
        // Credit, rate-limit and sign-in problems carry a message written for the artist, and
        // retrying right away won't help. Anything else is the service having a bad moment.
        const human = res.status === 401 || res.status === 402 || res.status === 429;
        if (human) {
          setStartFailure({ text: await readApiError(res, "Couldn't start the AI draft."), retry: null });
        } else {
          setStartFailure({ text: "Couldn't start the AI draft. No credits were spent.", retry: "start" });
        }
        return;
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch {
      setStartFailure({
        text: "Couldn't reach the server. Check your connection. No credits were spent.",
        retry: "start",
      });
    } finally {
      setIsStarting(false);
    }
  }

  function checkAgain() {
    if (!jobId) return;
    setRepollId(jobId);
    setJobId(null);
  }

  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "") : "";
  const outputId = `song-ai-output-${trackNumber}`;
  const hintId = `song-ai-hint-${trackNumber}`;

  const failure: Failure | null = startFailure
    ? startFailure
    : pollError
      ? { text: "Lost touch with the AI draft while it was running.", retry: "poll" }
      : job?.status === "failed"
        ? { text: `The AI draft couldn't be finished. Your ${COST_LABEL} were refunded.`, retry: "start" }
        : null;

  const buttonLabel = isStarting
    ? "Starting…"
    : isPolling
      ? `Drafting… ${formatElapsed(elapsedMs)}`
      : output
        ? `New AI draft · ${COST_LABEL}`
        : `AI draft · ${COST_LABEL}`;

  const icon = isBusy ? (
    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
  ) : (
    <Sparkles className="h-4 w-4" aria-hidden="true" />
  );

  return (
    <section aria-labelledby="song-ai-title" className="flex min-w-0 flex-col gap-3 border-t border-line pt-4">
      <h3 id="song-ai-title" className="text-base font-semibold text-ink">
        Draft this track with AI
      </h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {aiAvailable ? (
          <ConfirmSpend
            cost={COST}
            remaining={creditsRemaining}
            actionLabel={output ? "Start a new AI draft" : "Start AI draft"}
            onConfirm={start}
            busy={isBusy}
          >
            {icon}
            {buttonLabel}
          </ConfirmSpend>
        ) : (
          // Can't run here: the button stays, disabled and unpriced (nothing can be spent), and
          // the one plain line on this screen says why.
          <Button tone="secondary" disabled aria-describedby={unavailable.describedBy}>
            {icon}
            AI draft
          </Button>
        )}
        {aiAvailable ? (
          <p id={hintId} className="min-w-0 max-w-[65ch] flex-1 basis-60 text-sm leading-relaxed text-ink-2">
            An AI draft of lyrics, harmony ideas and production notes for this track, from the
            album&rsquo;s concept. It takes about a minute; nothing here changes until you copy lines in.
          </p>
        ) : unavailable.show ? (
          <AiUnavailableNote id={unavailable.noticeId} className="min-w-0 flex-1 basis-60" />
        ) : null}
      </div>

      {aiAvailable ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="max-w-[65ch] text-sm text-ink-2">
            {isPolling && !output
              ? "Writing lyrics, suggesting harmony and drafting production notes. This usually takes 30 to 90 seconds."
              : output
                ? "AI draft ready."
                : ""}
          </p>
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-danger">
            {failure && !isBusy ? (
              <>
                <span className="min-w-0 max-w-[65ch]">{failure.text}</span>
                {failure.retry === "start" ? (
                  <ConfirmSpend cost={COST} remaining={creditsRemaining} actionLabel="Retry the AI draft" onConfirm={start}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Retry AI draft · {COST_LABEL}
                  </ConfirmSpend>
                ) : failure.retry === "poll" ? (
                  <Button tone="secondary" onClick={checkAgain}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Check again
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {output ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold text-ink">
              AI draft for track {String(trackNumber).padStart(2, "0")}: {songTitle}
            </p>
            <Button tone="ghost" aria-expanded={expanded} aria-controls={outputId} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide AI draft" : "Show AI draft"}
            </Button>
          </div>
          {expanded ? (
            <div
              id={outputId}
              className="max-h-96 max-w-[70ch] overflow-auto rounded border border-line bg-sunken px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-2"
            >
              {output}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
