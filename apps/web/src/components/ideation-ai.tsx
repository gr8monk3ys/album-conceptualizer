"use client";

import { useId, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { ConfirmSpend } from "@/components/confirm-spend";
import { Button, StatusMessage } from "@/components/ui";
import { useAgentJob } from "@/hooks/use-agent-job";
import { AI_UNAVAILABLE_MESSAGE } from "@/lib/ai";
import { CREDIT_COSTS } from "@/lib/credit-costs";

/** What the artist chose to take from a brainstorm into the blueprint. */
export type BrainstormPatch = {
  conceptSummary?: string;
  themes?: string[];
  trackTitles?: string[];
};

type IdeationAiProps = {
  concept: string;
  references: string;
  themes: string;
  trackCount: number;
  /** False when this server can't run AI workflows: the button stays visible but disabled. */
  aiAvailable: boolean;
  /** The workspace balance, so the spend confirm can say what's left after. */
  creditsRemaining?: number;
  /** Applies the chosen parts and returns a function that undoes exactly that change. */
  onApply: (patch: BrainstormPatch) => () => void;
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

/** The server's human-written `error` field, or a plain fallback. Never a bare status code. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
}

// ---------------------------------------------------------------------------------------------
// Reading a brainstorm. The output is free text (usually Markdown); this pulls out a concept,
// themes and track titles where the text labels them clearly, and nothing more. Anything it
// cannot read with confidence is left for the artist to copy by hand.

const LIST_ITEM = /^\s*(?:[-*•]|\d{1,2}\s*[.)]|track\s*\d{1,2}\s*[.):\-–—]?)\s*/i;

function plain(line: string) {
  return line
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\*\*|__|`/g, "")
    .trim();
}

function isHeading(line: string) {
  const trimmed = line.trim();
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(trimmed)) return true;
  return /^[A-Za-z][\w '&/()-]{1,48}:\s*$/.test(trimmed);
}

function isListItem(line: string) {
  return LIST_ITEM.test(line);
}

function markerKind(line: string) {
  if (/^\s*[-*•]/.test(line)) return "bullet";
  if (/^\s*track/i.test(line)) return "track";
  return "number";
}

function labelled(line: string, names: string): string | null {
  const match = plain(line).match(
    new RegExp(
      `^(?:[-*•]\\s*)?(?:the\\s+)?(?:album(?:'s)?\\s+|core\\s+|central\\s+|key\\s+|main\\s+|overall\\s+)?(?:${names})s?\\b\\s*(?:[:\\-–—]\\s*(.*))?$`,
      "i",
    ),
  );
  if (!match) return null;
  return (match[1] ?? "").trim();
}

function uniqueList(values: string[], max: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function themeFrom(text: string) {
  const head = plain(text.replace(LIST_ITEM, "")).split(/\s[-–—]\s|:\s/)[0] ?? "";
  return head.replace(/^["“]|["”.]$/g, "").trim();
}

/** "love, loss and rebirth" → three themes; "love and loss" alone stays one. */
function splitThemes(text: string) {
  const parts = text.split(/,|;|\s\/\s/);
  if (parts.length > 1) {
    const last = parts.pop() ?? "";
    parts.push(...last.split(/\s(?:and|&)\s/i));
  }
  return parts.map(themeFrom);
}

function titleFrom(text: string): string | null {
  const body = plain(text.replace(LIST_ITEM, ""));
  const quoted = body.match(/["“]([^"“”]{1,80})["”]/);
  const raw = quoted ? quoted[1] : (body.split(/\s[-–—]\s|:\s|\s\(/)[0] ?? "");
  const title = raw.replace(/^["“*_\s]+|["”*_\s.,;]+$/g, "").trim();
  if (!title || title.length > 80) return null;
  return title;
}

function paragraphAfter(lines: string[], start: number) {
  const parts: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      if (parts.length) break;
      continue;
    }
    if (isHeading(line) || (isListItem(line) && parts.length === 0 && /^\s*\d/.test(line))) break;
    parts.push(plain(line.replace(/^\s*[-*•]\s*/, "")));
  }
  return parts.join(" ").trim();
}

function indentOf(line: string) {
  return line.length - line.trimStart().length;
}

/** The list that follows a heading, top level only (nested notes under an item are skipped). */
function itemsAfter(lines: string[], start: number) {
  const items: string[] = [];
  let indent = -1;
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      if (items.length) {
        // A blank line ends the list unless the next line carries on with another item.
        const next = lines.slice(i + 1).find((candidate) => candidate.trim());
        if (!next || !isListItem(next) || markerKind(next) !== markerKind(items[0])) break;
      }
      continue;
    }
    if (isListItem(line)) {
      if (indent < 0) indent = indentOf(line);
      if (indentOf(line) <= indent) items.push(line);
      continue;
    }
    if (items.length && indentOf(line) > indent) continue;
    if (items.length || isHeading(line)) break;
  }
  return items;
}

export type ParsedBrainstorm = {
  concept: string | null;
  themes: string[];
  trackTitles: string[];
  /** False when nothing could be read as a labelled part; the whole text is then the concept. */
  structured: boolean;
};

export function parseBrainstorm(output: string): ParsedBrainstorm {
  const lines = output.split(/\r?\n/);
  let concept: string | null = null;
  let themes: string[] = [];
  let trackTitles: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;

    if (concept === null) {
      const rest = labelled(line, "concept|vision|logline|premise|summary|overview|core idea|big idea");
      if (rest !== null) {
        // Under a heading the concept is the paragraph that follows; on a "Concept: …" line
        // it is the rest of the line and its continuation.
        const text =
          rest && !isHeading(line) && !/^\s*#/.test(line)
            ? [rest, paragraphAfter(lines, i + 1)].filter(Boolean).join(" ")
            : paragraphAfter(lines, i + 1);
        if (text) concept = text.slice(0, 2000);
      }
    }

    if (!themes.length) {
      const rest = labelled(line, "theme");
      if (rest !== null) {
        const found = rest ? splitThemes(rest) : itemsAfter(lines, i + 1).map(themeFrom);
        themes = uniqueList(
          found.filter((value) => value.length > 0 && value.length <= 40),
          8,
        );
      }
    }

    if (trackTitles.length < 3 && /track\s*list|tracklist|tracks|songs|sequenc|running order/i.test(plain(line))) {
      if (isHeading(line) || labelled(line, "tracklist|track list|tracks|songs|sequence|running order") === "") {
        const found = itemsAfter(lines, i + 1)
          .map(titleFrom)
          .filter((value): value is string => Boolean(value));
        if (found.length >= 3) trackTitles = uniqueList(found, 20);
      }
    }
  }

  if (trackTitles.length < 3) {
    const found = lines
      .filter((line) => /^\s*(?:[-*•]\s*)?(?:\*\*)?track\s*\d{1,2}\b/i.test(line))
      .map(titleFrom)
      .filter((value): value is string => Boolean(value));
    trackTitles = found.length >= 3 ? uniqueList(found, 20) : [];
  }

  const structured = Boolean(concept || themes.length || trackTitles.length);
  if (!structured) {
    const whole = output.trim();
    return { concept: whole ? whole.slice(0, 10_000) : null, themes: [], trackTitles: [], structured };
  }
  return { concept, themes, trackTitles, structured };
}

// ---------------------------------------------------------------------------------------------

function BrainstormResult({ output, onApply }: { output: string; onApply: IdeationAiProps["onApply"] }) {
  const parsed = useMemo(() => parseBrainstorm(output), [output]);
  const id = useId();
  // The artist's own concept stays unless they tick it; themes and titles start ticked.
  const [takeConcept, setTakeConcept] = useState(Boolean(parsed.concept) && !parsed.structured);
  const [takeThemes, setTakeThemes] = useState(parsed.themes.length > 0);
  const [takeTracks, setTakeTracks] = useState(parsed.trackTitles.length > 0);
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const [undone, setUndone] = useState(false);

  const nothingChosen =
    !(takeConcept && parsed.concept) &&
    !(takeThemes && parsed.themes.length) &&
    !(takeTracks && parsed.trackTitles.length);

  function apply() {
    const patch: BrainstormPatch = {};
    if (takeConcept && parsed.concept) patch.conceptSummary = parsed.concept;
    if (takeThemes && parsed.themes.length) patch.themes = parsed.themes;
    if (takeTracks && parsed.trackTitles.length) patch.trackTitles = parsed.trackTitles;
    const revert = onApply(patch);
    setUndo(() => revert);
    setUndone(false);
  }

  const checkboxRow = "flex min-h-11 cursor-pointer items-start gap-3 py-2";

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div
        role="region"
        aria-label="Brainstorm result"
        tabIndex={0}
        className="max-h-80 overflow-auto whitespace-pre-wrap border-y border-line py-3 text-sm leading-relaxed text-ink-2"
      >
        {output}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Choose what to take into your blueprint</legend>
        {!parsed.structured ? (
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            This result has no clearly labelled themes or tracklist, so it can only be used as a whole.
          </p>
        ) : null}
        <div className="mt-1 flex flex-col">
          {parsed.concept ? (
            <label htmlFor={`${id}-concept`} className={checkboxRow}>
              <input
                id={`${id}-concept`}
                type="checkbox"
                checked={takeConcept}
                onChange={(event) => setTakeConcept(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
              />
              <span className="text-sm text-ink">
                {parsed.structured ? "Use its concept" : "Use the whole result as the concept"}
                <span className="block text-xs text-ink-3">Replaces what you wrote in the summary above.</span>
              </span>
            </label>
          ) : null}
          {parsed.themes.length ? (
            <label htmlFor={`${id}-themes`} className={checkboxRow}>
              <input
                id={`${id}-themes`}
                type="checkbox"
                checked={takeThemes}
                onChange={(event) => setTakeThemes(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
              />
              <span className="min-w-0 text-sm text-ink">
                Use its {parsed.themes.length} {parsed.themes.length === 1 ? "theme" : "themes"}
                <span className="block break-words text-xs text-ink-3">{parsed.themes.join(", ")}</span>
              </span>
            </label>
          ) : null}
          {parsed.trackTitles.length ? (
            <label htmlFor={`${id}-tracks`} className={checkboxRow}>
              <input
                id={`${id}-tracks`}
                type="checkbox"
                checked={takeTracks}
                onChange={(event) => setTakeTracks(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
              />
              <span className="min-w-0 text-sm text-ink">
                Use its {parsed.trackTitles.length} track titles
                <span className="block break-words text-xs text-ink-3">
                  {parsed.trackTitles.slice(0, 4).join(", ")}
                  {parsed.trackTitles.length > 4 ? ", …" : ""}
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={apply} disabled={nothingChosen}>
          Apply to blueprint
        </Button>
        {undo && !undone ? (
          <>
            <StatusMessage tone="ok">Applied. Check the fields and change anything you like.</StatusMessage>
            <Button
              tone="ghost"
              onClick={() => {
                undo();
                setUndone(true);
              }}
            >
              Undo
            </Button>
          </>
        ) : null}
        {undone ? <StatusMessage>Undone. Your blueprint is back as it was.</StatusMessage> : null}
      </div>
    </div>
  );
}

/**
 * An optional helper on the first step of the create wizard: the AI reads the concept and
 * suggests a direction. Its result is shown as text; nothing reaches the blueprint until the
 * artist picks parts of it and presses "Apply to blueprint".
 */
export function IdeationAi({
  concept,
  references,
  themes,
  trackCount,
  aiAvailable,
  creditsRemaining,
  onApply,
}: IdeationAiProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { job, error: pollError, elapsedMs, isPolling } = useAgentJob({ jobId });

  async function start() {
    setIsStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/agents/ideation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          concept,
          references,
          themes,
          track_count: trackCount,
        }),
      });
      if (!res.ok) {
        throw new Error(
          await readError(res, "The brainstorm couldn't start. Check your connection and try again."),
        );
      }
      const data = (await res.json()) as StartJobResponse;
      setJobId(data.job_id);
    } catch (err) {
      setStartError(
        err instanceof Error && err.message
          ? err.message
          : "The brainstorm couldn't start. Check your connection and try again.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  // The job hook's errors are already written for the artist.
  const error = startError ?? pollError;
  const isBusy = isStarting || isPolling;
  const output = job?.status === "completed" ? (job.result?.output ?? "").trim() : "";
  const failed = job?.status === "failed";
  const hasEnoughInput = concept.trim().length > 0;
  const cost = CREDIT_COSTS.agentRun;

  const label = isStarting
    ? "Starting…"
    : isPolling
      ? `Brainstorming… ${formatElapsed(elapsedMs)}`
      : jobId
        ? `Brainstorm again · ${cost} credits`
        : `Brainstorm with AI · ${cost} credits`;

  return (
    <section aria-labelledby="brainstorm-title" className="border-t border-line pt-5">
      <h3 id="brainstorm-title" className="text-base font-semibold text-ink">
        Need a starting point? <span className="font-normal text-ink-3">Optional</span>
      </h3>
      {aiAvailable ? (
        <p id="brainstorm-hint" className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-2">
          The AI reads your concept summary and suggests a direction, themes and a tracklist. It
          takes 30 to 90 seconds. Nothing changes in your blueprint until you choose what to apply.
        </p>
      ) : (
        <p id="brainstorm-hint" className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
          {AI_UNAVAILABLE_MESSAGE}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {aiAvailable ? (
          <ConfirmSpend
            cost={cost}
            remaining={creditsRemaining}
            actionLabel={jobId ? "Brainstorm again" : "Brainstorm"}
            onConfirm={start}
            busy={isBusy}
            disabled={!hasEnoughInput}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {label}
          </ConfirmSpend>
        ) : (
          // Can't run here: no price on a button that can't spend; the line above says why.
          <Button disabled aria-describedby="brainstorm-hint">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Brainstorm with AI
          </Button>
        )}
        {aiAvailable && !hasEnoughInput && !jobId ? (
          <p id="brainstorm-needs-concept" className="text-xs text-ink-3">
            Write a concept summary first; the brainstorm builds on it.
          </p>
        ) : null}
      </div>

      {isPolling ? (
        <StatusMessage className="mt-3">
          Brainstorming. This usually takes 30 to 90 seconds; you can keep writing meanwhile.
        </StatusMessage>
      ) : null}

      {error ? (
        <StatusMessage tone="danger" className="mt-3">
          {error}
        </StatusMessage>
      ) : null}

      {failed ? (
        <StatusMessage tone="danger" className="mt-3">
          The brainstorm didn&apos;t finish, and its {CREDIT_COSTS.agentRun} credits were refunded. Try again
          in a minute, or carry on with your own concept: the rest of the setup works without it.
        </StatusMessage>
      ) : null}

      {job?.status === "completed" && !output ? (
        <StatusMessage className="mt-3">The brainstorm came back empty. Try again with a longer concept.</StatusMessage>
      ) : null}

      {output && jobId ? <BrainstormResult key={jobId} output={output} onApply={onApply} /> : null}
    </section>
  );
}
