"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button, Section, StatusMessage } from "@/components/ui";
import { useAgentJob } from "@/hooks/use-agent-job";
import { CREDIT_COSTS } from "@/lib/credit-costs";

type StartJobResponse = { job_id: string };

const COST = CREDIT_COSTS.agentRun;

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const UNAVAILABLE_LINE = "AI drafting isn't set up on this server. Everything else works without it.";

/** Failures that describe setup, not a hiccup: trying again won't change them. */
const NOT_AVAILABLE = /\b(not|isn.t|aren.t) (available|configured|set up)\b|unavailable/i;

/** A status that may clear on its own (the engine or network hiccuped). */
function transientStatus(status: number) {
  return status === 502 || status === 504 || status === 503;
}

class StartError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Status-code-only messages ("HTTP 502") are not something to show an artist. */
function plain(message: string | null, fallback: string) {
  if (!message || /^HTTP \d+$/.test(message.trim())) return fallback;
  return message;
}

/**
 * A written review from the coherence agent, on top of the rule-based checks on this page.
 * It spends credits, so the cost is on the button.
 */
export function CoherenceAiReview({ albumId, aiAvailable }: { albumId: string; aiAvailable: boolean }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ text: string; retryable: boolean } | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });

  async function start() {
    setIsStarting(true);
    setStartError(null);
    setJobId(null);
    try {
      let res: Response;
      try {
        res = await fetch("/api/agents/coherence-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ album_id: albumId }),
        });
      } catch {
        throw new StartError(
          "The review didn't start because the connection dropped. No credits were spent.",
          true,
        );
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        const message =
          typeof body?.error === "string" && body.error
            ? body.error
            : transientStatus(res.status)
              ? "The review didn't start, and no credits were spent. Try again in a moment."
              : "The review didn't start, and no credits were spent.";
        throw new StartError(message, transientStatus(res.status) && !NOT_AVAILABLE.test(message));
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch (err) {
      setStartError(
        err instanceof StartError
          ? { text: err.message, retryable: err.retryable }
          : { text: "The review didn't start. No credits were spent.", retryable: false },
      );
    } finally {
      setIsStarting(false);
    }
  }

  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "") : "";
  const failedText = job?.status === "failed" ? plain(job.error, "The review stopped before it finished.") : null;
  const error = startError
    ? startError
    : pollError
      ? { text: plain(pollError, "We lost track of the review while it was running."), retryable: true }
      : failedText
        ? { text: failedText, retryable: !NOT_AVAILABLE.test(failedText) }
        : null;

  const buttonLabel = isStarting
    ? "Starting…"
    : isPolling
      ? `Reviewing… ${formatElapsed(elapsedMs)}`
      : output
        ? `Run again · ${COST} credits`
        : `Run review · ${COST} credits`;

  return (
    <Section
      id="coherence-written-review"
      title="Written review"
      description={`An agent reads the Album Bible and every track, then writes up where the record holds together and where it drifts. Each run costs ${COST} credits and takes about 30 to 90 seconds.`}
      actions={
        <Button
          onClick={() => void start()}
          disabled={!aiAvailable || isBusy}
          aria-busy={isBusy || undefined}
          aria-describedby={aiAvailable ? undefined : "coherence-ai-unavailable"}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {buttonLabel}
        </Button>
      }
    >
      {!aiAvailable ? (
        <p id="coherence-ai-unavailable" className="max-w-[65ch] text-sm text-ink-2">
          {UNAVAILABLE_LINE}
        </p>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusMessage tone="danger" className="max-w-[65ch]">
            {error.text}
          </StatusMessage>
          {error.retryable && aiAvailable ? (
            <Button tone="ghost" onClick={() => void start()} disabled={isBusy}>
              {`Try again · ${COST} credits`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isPolling && !output ? (
        <StatusMessage>The agent is reading your Bible and tracks. Keep this page open.</StatusMessage>
      ) : null}

      {output ? (
        <div className="max-w-[65ch] whitespace-pre-wrap border-l border-line-strong pl-4 text-sm leading-relaxed text-ink-2">
          {output}
        </div>
      ) : null}

      {aiAvailable && !jobId && !error && !isStarting ? (
        <p className="text-sm text-ink-3">No written review yet for this draft.</p>
      ) : null}
    </Section>
  );
}
