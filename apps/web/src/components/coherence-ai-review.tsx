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

/** Status-code-only messages ("HTTP 502") are not something to show an artist. */
function plain(message: string | null, fallback: string) {
  if (!message || /^HTTP \d+$/.test(message.trim())) return fallback;
  return message;
}

/**
 * A written review from the coherence agent, on top of the rule-based checks on this page.
 * It spends credits, so the cost is on the button.
 */
export function CoherenceAiReview({ albumId }: { albumId: string }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });

  async function start() {
    setIsStarting(true);
    setStartError(null);
    setJobId(null);
    try {
      const res = await fetch("/api/agents/coherence-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album_id: albumId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof body?.error === "string" && body.error
            ? body.error
            : "The review didn't start, and no credits were spent. Try again in a moment.",
        );
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "The review didn't start. Try again in a moment.");
    } finally {
      setIsStarting(false);
    }
  }

  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "") : "";
  const error = startError
    ? startError
    : pollError
      ? plain(pollError, "We lost track of the review while it was running. Try again.")
      : job?.status === "failed"
        ? plain(job.error, "The review stopped before it finished. Try again.")
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
        <Button onClick={() => void start()} disabled={isBusy} aria-busy={isBusy || undefined}>
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {buttonLabel}
        </Button>
      }
    >
      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusMessage tone="danger">{error}</StatusMessage>
          <Button tone="ghost" onClick={() => void start()} disabled={isBusy}>
            {`Try again · ${COST} credits`}
          </Button>
        </div>
      ) : null}

      {isPolling && !output ? (
        <StatusMessage>The agent is reading your Bible and tracks. Keep this page open.</StatusMessage>
      ) : null}

      {output ? (
        <div className="max-w-[72ch] whitespace-pre-wrap border-l border-line-strong pl-4 text-sm leading-relaxed text-ink-2">
          {output}
        </div>
      ) : null}

      {!jobId && !error && !isStarting ? (
        <p className="text-sm text-ink-3">No written review yet for this draft.</p>
      ) : null}
    </Section>
  );
}
