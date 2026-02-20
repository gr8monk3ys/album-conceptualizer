"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

import type { DailyChallenge } from "@/server/challenges";

export function DailyChallengeCard({
  day,
  challenge,
  completed,
  completionNote,
  completionTime,
}: {
  day: string;
  challenge: DailyChallenge;
  completed: boolean;
  completionNote: string | null;
  completionTime: string | null;
}) {
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneOverride, setDoneOverride] = useState<boolean | null>(null);
  const note = noteDraft ?? (completionNote ?? "");
  const done = doneOverride ?? completed;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/challenges/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeKey: challenge.key,
          notes: note,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status}).`);
      }

      setDoneOverride(true);
      // Reload so sidebar credits + streak sidebar reflect latest server state.
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not complete challenge.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs text-[var(--muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Daily challenge · {day} (UTC)
          </div>
          <div className="mt-3 text-xl font-semibold tracking-tight text-[var(--text)]">
            {challenge.title}
          </div>
          <div className="mt-2 max-w-[70ch] text-sm leading-relaxed text-[var(--muted)]">
            {challenge.description}
          </div>
        </div>

        <div className="rounded-2xl bg-[rgba(50,213,131,0.14)] px-4 py-3 text-center">
          <div className="text-xs text-[var(--muted2)]">Reward</div>
          <div className="mt-1 text-lg font-semibold text-[var(--ok)]">
            +{challenge.credits}
          </div>
          <div className="text-xs text-[var(--muted2)]">credits</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.22)] p-4">
        <div className="text-xs text-[var(--muted2)]">Completion note</div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          What did you draft today? (Used to keep you honest and help future you.)
        </div>
        <textarea
          value={note}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={4}
          disabled={done}
          className="mt-3 w-full resize-y rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)] disabled:opacity-70"
          placeholder="e.g., Drafted chorus lyrics for Track 3 + locked a C–Am–F–G loop."
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {done ? (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ok)]">
              <CheckCircle2 className="h-4 w-4" />
              Completed{completionTime ? ` at ${new Date(completionTime).toLocaleTimeString()}` : ""}
            </div>
          ) : (
            <div className="text-xs text-[var(--muted2)]">One completion per day.</div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={done || submitting || note.trim().length < 10}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Completing…" : challenge.cta}
          </button>
        </div>

        {error ? <div className="mt-3 text-xs text-[var(--muted)]">{error}</div> : null}
      </div>
    </section>
  );
}
