"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { RelativeTime } from "@/components/relative-time";
import { Button, Field, Panel, StatusMessage, textareaClass } from "@/components/ui";
import type { DailyChallenge } from "@/server/challenges";

const MIN_NOTE = 10;

/** Today's prompt as a small form: write a note on what you drafted, then mark it done. */
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
  const router = useRouter();
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const note = noteDraft ?? completionNote ?? "";
  const done = justCompleted || completed;
  const remaining = Math.max(0, MIN_NOTE - note.trim().length);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (done || remaining > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/challenges/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeKey: challenge.key, notes: note }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof body?.error === "string" && body.error
            ? body.error
            : "The challenge wasn't marked complete. Try again in a moment.",
        );
      }
      setJustCompleted(true);
      // Refresh the server-rendered credit balance and streak without losing this message.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The challenge wasn't marked complete. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel>
      <section aria-labelledby="challenge-title">
        <h2 id="challenge-title" className="type-display text-2xl text-ink">
          {challenge.title}
        </h2>
        <p className="type-catalog mt-2 text-xs text-ink-2">
          <span className="type-figure">{day}</span> · Completing earns{" "}
          <span className="type-figure">{challenge.credits}</span> credits
        </p>
        <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-ink">{challenge.description}</p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <Field
            htmlFor="challenge-note"
            label="What did you write?"
            hint={
              done
                ? "Your note for today."
                : remaining > 0
                  ? `A sentence is enough: which album, which track, what you drafted. ${remaining} more ${remaining === 1 ? "character" : "characters"} to go.`
                  : "A sentence is enough: which album, which track, what you drafted."
            }
          >
            <textarea
              id="challenge-note"
              value={note}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              maxLength={800}
              readOnly={done}
              aria-describedby="challenge-note-hint"
              className={textareaClass}
              placeholder="Drafted the chorus for track 3 and locked a C–Am–F–G loop."
            />
          </Field>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {done ? null : (
              <Button tone="primary" type="submit" disabled={submitting || remaining > 0}>
                {submitting ? "Saving…" : `${challenge.cta} · earn ${challenge.credits} credits`}
              </Button>
            )}
            {done ? (
              <StatusMessage tone="ok">
                {justCompleted ? (
                  `Done for today. ${challenge.credits} credits added to your workspace.`
                ) : (
                  <>
                    Done for today
                    {completionTime ? (
                      <>
                        {" "}
                        (<RelativeTime date={completionTime} />)
                      </>
                    ) : null}
                    . A new prompt arrives at 00:00 UTC.
                  </>
                )}
              </StatusMessage>
            ) : null}
            {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
          </div>
        </form>
      </section>
    </Panel>
  );
}
