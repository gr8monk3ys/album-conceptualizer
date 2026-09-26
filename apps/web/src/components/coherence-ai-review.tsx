"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { ConfirmSpend } from "@/components/confirm-spend";
import { LiveStatus, Section } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useAgentJob } from "@/hooks/use-agent-job";
import { CREDIT_COSTS } from "@/lib/credit-costs";

type StartJobResponse = { job_id: string };

const COST: number = CREDIT_COSTS.agentRun;
const PRICE = `${COST} ${COST === 1 ? "credit" : "credits"}`;

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

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

/** End a message with a full stop so another sentence can follow it. */
function sentence(text: string) {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Status-code-only messages ("HTTP 502") are not something to show an artist. */
function plain(message: string | null, fallback: string) {
  if (!message || /^HTTP \d+$/.test(message.trim())) return fallback;
  return message;
}

/**
 * A written review, drafted by AI, on top of the rule-based checks on this page. It spends
 * credits as an "AI draft", so the price is on the button and it asks once before spending.
 * Rendered only where AI can run (`getAgentAvailability()`): when it can't, the Coherence
 * report leaves the section out, and Help and Billing say so once (a feature that can't run
 * takes no space in the writing path).
 */
export function CoherenceAiReview({
  albumId,
  creditsRemaining,
}: {
  albumId: string;
  /** The workspace balance, so the spend confirm can say what's left after. */
  creditsRemaining?: number;
}) {
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
  const failedText =
    job?.status === "failed"
      ? `${sentence(plain(job.error, "The review stopped before it finished."))} Your ${PRICE} were refunded.`
      : null;
  const error = startError
    ? startError
    : pollError
      ? { text: plain(pollError, "We lost track of the review while it was running."), retryable: true }
      : failedText
        ? { text: failedText, retryable: !NOT_AVAILABLE.test(failedText) }
        : null;

  // The retry goes away once the new AI draft starts. If it had focus, focus moves to the
  // section's own AI draft button after the commit, never to the page body.
  const showRetry = Boolean(error?.retryable);
  const actionsRef = useRef<HTMLSpanElement>(null);
  const retryShown = useRef(false);
  useLayoutEffect(() => {
    if (retryShown.current && !showRetry && (!document.activeElement || document.activeElement === document.body)) {
      actionsRef.current?.querySelector("button")?.focus();
    }
    retryShown.current = showRetry;
  }, [showRetry]);

  const buttonLabel = isStarting
    ? "Starting…"
    : isPolling
      ? `Reviewing… ${formatElapsed(elapsedMs)}`
      : output
        ? `New AI draft · ${PRICE}`
        : `AI draft · ${PRICE}`;

  return (
    <Section
      id="coherence-written-review"
      title="Written review"
      description={`An AI draft of a review: it reads the Story bible and every track, then writes up where the record holds together and where it drifts. Each AI draft costs ${PRICE} and takes about 30 to 90 seconds.`}
      actions={
        <span ref={actionsRef} className="contents">
          <ConfirmSpend
            cost={COST}
            remaining={creditsRemaining}
            actionLabel={output ? "Start a new AI draft" : "Start AI draft"}
            onConfirm={start}
            busy={isBusy}
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {buttonLabel}
          </ConfirmSpend>
        </span>
      }
    >
      {/* One live region for the review, mounted from the start so each change is announced;
          the retry sits beside it, outside the region. */}
      <div className={cn("flex flex-wrap items-center gap-3", (error || isPolling) && !output && "mb-3")}>
        <LiveStatus
          className="max-w-[65ch]"
          tone={error ? "danger" : "neutral"}
          message={
            error
              ? error.text
              : isPolling && !output
                ? "The AI draft is reading your Story bible and tracks. Keep this page open."
                : null
          }
        />
        {showRetry ? (
          <ConfirmSpend
            cost={COST}
            remaining={creditsRemaining}
            actionLabel="Try the AI draft again"
            onConfirm={start}
            busy={isBusy}
            tone="ghost"
          >
            {`Try the AI draft again · ${PRICE}`}
          </ConfirmSpend>
        ) : null}
      </div>

      {output ? (
        <div className="max-w-[65ch] whitespace-pre-wrap border-l border-line-strong pl-4 text-sm leading-relaxed text-ink-2">
          {output}
        </div>
      ) : null}

      {!jobId && !error && !isStarting ? (
        <p className="text-sm text-ink-3">No written review yet for this version of the album.</p>
      ) : null}
    </Section>
  );
}
