"use client";

import Link from "next/link";
import { useState } from "react";

import {
  chordProblem,
  readTempo,
  tempoClampedNote,
  tempoLimitMessage,
  unreadableChords,
} from "@/components/studio/input-checks";
import { TEMPO_MAX, TEMPO_MIN, parseChordProgression, stringifyChordProgression } from "@/components/studio/studio-model";
import { Field, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The section's chords, checked as they're typed: a token the exports can't read is named in
 * coral under the field ("“banana” isn't a chord the exports can read — try Am, F#m7, G/B.")
 * and the field is marked invalid. What the artist typed is kept (stored as typed, in order);
 * lib/chords never counts a progression with an unreadable token as written.
 *
 * `starterLoop` (from lib/chords `isScaffoldSection`) says the chords are still the setup's
 * loop, which nothing counts as written; the rule is explained here, where it bites, as an
 * ordinary hint (Ash Ink): a fresh section isn't a problem, so it never borrows the warn colour.
 * Coral stays for chords the exports can't read. The hint ends with a link to Help's "What
 * counts as written".
 */
export function ChordField({
  id,
  value,
  onChange,
  starterLoop = false,
  className,
}: {
  id: string;
  value: unknown;
  onChange: (chords: string[]) => void;
  starterLoop?: boolean;
  className?: string;
}) {
  const stored = stringifyChordProgression(value);
  const [draft, setDraft] = useState(stored);
  const [seen, setSeen] = useState(stored);
  const [typing, setTyping] = useState(false);
  // A change from elsewhere (Undo, an AI draft accepted) replaces the typed text; the
  // artist's own edits come back here normalised and leave it alone.
  if (stored !== seen) {
    setSeen(stored);
    if (stringifyChordProgression(parseChordProgression(draft)) !== stored) setDraft(stored);
  }
  const problem = chordProblem(unreadableChords(draft, { typing }));

  return (
    <Field
      label="Chord progression"
      htmlFor={id}
      className={className}
      error={problem ?? undefined}
      hint={
        <>
          {starterLoop ? (
            <span className="block max-w-[65ch]">Still the starter loop — change a chord to make it this track’s own.</span>
          ) : null}
          <span className="block max-w-[65ch]">
            Separate chords with spaces or commas. Loops of 4 to 8 chords export cleanly.{" "}
            <Link
              href="/app/help#written-title"
              className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
            >
              What counts as written
            </Link>
          </span>
        </>
      }
    >
      {(control) => (
        <input
          {...control}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setTyping(true);
            onChange(parseChordProgression(e.target.value));
          }}
          onBlur={() => {
            setTyping(false);
            setDraft(stringifyChordProgression(parseChordProgression(draft)));
          }}
          autoComplete="off"
          spellCheck={false}
          className={cn(inputClass, problem && "border-danger/60")}
          placeholder="C Am F G"
        />
      )}
    </Field>
  );
}

/**
 * The track's tempo. Out of range, the limit is named in coral while typing ("Tempo is capped
 * at 300 bpm."); a value above the cap is stored as the cap at once, one below the floor only
 * when the field is left (it may be the first digit of 120). Once set to a limit, a note says
 * so, and `onClamped` gets the same sentence for the page's announcer.
 */
export function TempoField({
  id,
  value,
  onChange,
  onClamped,
  className,
}: {
  id: string;
  value: number | null | undefined;
  onChange: (tempo: number | null) => void;
  onClamped?: (message: string) => void;
  className?: string;
}) {
  const stored = typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  const [draft, setDraft] = useState(stored);
  const [seen, setSeen] = useState(stored);
  const [note, setNote] = useState<string | null>(null);
  if (stored !== seen) {
    setSeen(stored);
    if (readTempo(draft).tempo !== (value ?? null)) setDraft(stored);
  }
  const reading = readTempo(draft);
  const error = reading.clamped
    ? tempoLimitMessage(reading.clamped)
    : reading.unreadable
      ? `Tempo is a number of beats per minute, from ${TEMPO_MIN} to ${TEMPO_MAX}.`
      : undefined;

  return (
    <Field
      label="Tempo (bpm)"
      htmlFor={id}
      className={className}
      error={error}
      hint={note ? <span className="block max-w-[65ch]">{note}</span> : undefined}
    >
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={TEMPO_MIN}
        max={TEMPO_MAX}
        step={1}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          setNote(null);
          if (e.target.validity.badInput) return;
          const next = readTempo(raw);
          if (next.unreadable || next.clamped === "low") return;
          onChange(next.tempo);
        }}
        onBlur={() => {
          const next = readTempo(draft);
          if (next.unreadable) {
            setDraft(stored);
            return;
          }
          if (!next.clamped) return;
          const message = tempoClampedNote(next.clamped);
          onChange(next.tempo);
          setDraft(String(next.tempo));
          setNote(message);
          onClamped?.(message);
        }}
        className={cn(inputClass, "type-figure", error && "border-danger/60")}
        placeholder="120"
      />
    </Field>
  );
}
