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
    <section className="rounded-2xl border border-line bg-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised px-3 py-1 text-xs text-ink-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Daily challenge · {day} (UTC)
          </div>
          <div className="mt-3 text-xl font-semibold tracking-tight text-ink">
            {challenge.title}
          </div>
          <div className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-2">
            {challenge.description}
          </div>
        </div>

        <div className="rounded-2xl bg-ok-soft px-4 py-3 text-center">
          <div className="text-xs text-ink-3">Reward</div>
          <div className="mt-1 text-lg font-semibold text-ok">
            +{challenge.credits}
          </div>
          <div className="text-xs text-ink-3">credits</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line-strong bg-sunken p-4">
        <div className="text-xs text-ink-3">Completion note</div>
        <div className="mt-1 text-sm text-ink-2">
          What did you draft today? (Used to keep you honest and help future you.)
        </div>
        <textarea
          value={note}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={4}
          disabled={done}
          className="mt-3 w-full resize-y rounded-2xl border border-line-strong bg-raised px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-70"
          placeholder="e.g., Drafted chorus lyrics for Track 3 + locked a C–Am–F–G loop."
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {done ? (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-ok">
              <CheckCircle2 className="h-4 w-4" />
              Completed{completionTime ? ` at ${new Date(completionTime).toLocaleTimeString()}` : ""}
            </div>
          ) : (
            <div className="text-xs text-ink-3">One completion per day.</div>
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

        {error ? <div className="mt-3 text-xs text-ink-2">{error}</div> : null}
      </div>
    </section>
  );
}
