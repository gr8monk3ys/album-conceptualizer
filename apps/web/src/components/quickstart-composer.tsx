"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";

import { ConfirmSpend } from "@/components/confirm-spend";
import { IdeationAi, type BrainstormPatch } from "@/components/ideation-ai";
import { openingTrackTitle, trackTitlesByPosition } from "@/components/quickstart-track-names";
import { ReadOnlySpine } from "@/components/read-only-spine";
import { Button, Chip, Field, IconButton, LiveStatus, Panel, inputClass, textareaClass } from "@/components/ui";
import { STARTER_PROGRESSIONS } from "@/lib/chords";
import {
  CREATE_DRAFT_KEY,
  EMPTY_DRAFT,
  MAX_TRACKS,
  MIN_TRACKS,
  isBlankForm,
  parseCreateDraft,
  type CreateDraft,
  type NarrativeStructure,
  type QuickStartFormState,
} from "@/lib/create-draft";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { rangeValueAt, sliderPointerStart, swipeIntent } from "@/lib/swipe-intent";
import { SETUP_TEMPO } from "@/lib/tempo";
import { clearDraft, useDraftState } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";
import type { SpineRow } from "@/server/album-songs";

type StatusTone = "error" | "success" | "info";
type SetQuickStartField = <K extends keyof QuickStartFormState>(
  key: K,
  value: QuickStartFormState[K],
) => void;

type WizardStep = {
  key: string;
  title: string;
  detail: string;
};

type DraftAlbumIds = {
  albumId: string;
  songIds: string[];
  sectionIds: Record<number, [string, string]>;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    key: "foundation",
    title: "Foundation",
    detail: "The core idea, and why this album exists.",
  },
  {
    key: "direction",
    title: "Direction",
    detail: "The shape of the story, its themes and the records it sits next to.",
  },
  {
    key: "tracklist",
    title: "Sequence",
    detail: "How many tracks, and what they are called for now.",
  },
];

const NARRATIVE_OPTIONS: Array<{
  key: NarrativeStructure;
  label: string;
  description: string;
}> = [
  {
    key: "three-act",
    label: "Three-act",
    description: "Setup, collision and resolution across the record.",
  },
  {
    key: "hero's-journey",
    label: "Hero's journey",
    description: "A transformation with a clear emotional climb.",
  },
  {
    key: "circular",
    label: "Circular",
    description: "Ends where it began, with new meaning.",
  },
  {
    key: "non-linear",
    label: "Non-linear",
    description: "Fragments and flashbacks, sequenced by theme.",
  },
];

// Starting chord loops so each track can be previewed right away. They are placeholders for
// the artist to replace, not written material (lib/chords), and the preview says so.
const COMMON_PROGRESSIONS = STARTER_PROGRESSIONS;

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}

function splitListInput(raw: string): string[] {
  return raw
    .split(/\r?\n|,/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

/** One entry per line, blank lines dropped (references: an entry may contain a comma). */
function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function progressionFor(index: number) {
  return COMMON_PROGRESSIONS[index % COMMON_PROGRESSIONS.length] ?? COMMON_PROGRESSIONS[0];
}

function ensureDraftAlbumIds(ids: DraftAlbumIds, trackCount: number) {
  for (let index = 0; index < trackCount; index += 1) {
    if (!ids.songIds[index]) {
      ids.songIds[index] = newId();
    }
    if (!ids.sectionIds[index]) {
      ids.sectionIds[index] = [newId(), newId()];
    }
  }
}

function buildAlbumJson(input: QuickStartFormState, ids: DraftAlbumIds) {
  const now = new Date().toISOString();
  // A blank line keeps its place: that track is untitled and opens as "Track N".
  const trackNames = trackTitlesByPosition(input.trackNamesRaw, input.trackCount);
  const centralThemes = splitListInput(input.centralThemesRaw);
  // One per line, like track titles: "Blonde, Frank Ocean" is one reference, not two.
  const referenceAlbums = splitLines(input.referenceAlbumsRaw);

  const songs = Array.from({ length: input.trackCount }, (_, index) => {
    const trackNumber = index + 1;
    const title = openingTrackTitle(trackNames, index);
    const progression = progressionFor(index);
    const [verseId, chorusId] = ids.sectionIds[index] ?? [newId(), newId()];

    return {
      id: ids.songIds[index] ?? newId(),
      title,
      track_number: trackNumber,
      key: progression.key,
      tempo: SETUP_TEMPO,
      narrative_position: null,
      narrative_summary: null,
      themes: [],
      motifs: [],
      characters: [],
      genre_tags: [],
      mood_tags: [],
      reference_tracks: [],
      instrumentation: [],
      // Sections start empty: the artist writes the lyrics. Only a starting chord loop is set.
      sections: [
        {
          id: verseId,
          section_type: "verse",
          order: 1,
          lyrics: "",
          chord_progression: progression.chords,
        },
        {
          id: chorusId,
          section_type: "chorus",
          order: 2,
          lyrics: "",
          chord_progression: progression.chords,
        },
      ],
      time_signature: "4/4",
    };
  });

  return {
    id: ids.albumId,
    title: input.title.trim(),
    artist: input.artist.trim() || null,
    songs,
    created_at: now,
    updated_at: now,
    concept_summary: input.conceptSummary.trim() || null,
    narrative_structure: input.narrativeStructure,
    primary_genre: null,
    secondary_genres: [],
    era_influence: null,
    release_year: null,
    central_themes: centralThemes,
    recurring_motifs: [],
    reference_albums: referenceAlbums,
    visual_inspiration: [],
  };
}

function getStepValidity(step: number, form: QuickStartFormState) {
  if (step === 0) {
    return Boolean(form.title.trim() && form.conceptSummary.trim());
  }

  if (step === 1) {
    return Boolean(
      form.narrativeStructure ||
        splitListInput(form.centralThemesRaw).length > 0 ||
        splitLines(form.referenceAlbumsRaw).length > 0,
    );
  }

  return form.trackCount >= MIN_TRACKS;
}

/** A step can be opened only when every step before it is valid. */
function canOpenStep(step: number, form: QuickStartFormState) {
  for (let index = 0; index < step; index += 1) {
    if (!getStepValidity(index, form)) return false;
  }
  return true;
}

function WizardProgress({
  step,
  form,
  visited,
  onStepSelect,
}: {
  step: number;
  form: QuickStartFormState;
  visited: number;
  onStepSelect: (step: number) => void;
}) {
  return (
    // Rem-sized container query: when the three names don't fit side by side (a phone at 200%
    // text), the tabs show their step numbers; the name stays for screen readers and in the
    // step heading below.
    <nav aria-label="Setup steps" className="@container">
      <ol className="grid grid-cols-3 border-b border-line">
        {WIZARD_STEPS.map((item, index) => {
          const active = index === step;
          const reachable = canOpenStep(index, form);
          const done = !active && index <= visited && getStepValidity(index, form);
          return (
            <li key={item.key} className="min-w-0">
              <button
                type="button"
                onClick={() => onStepSelect(index)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                title={reachable ? undefined : "Finish the earlier steps first"}
                className={cn(
                  "-mb-px flex min-h-11 w-full min-w-0 flex-col items-start justify-center border-b-2 px-1 pb-2 pt-1 text-left transition-colors disabled:cursor-not-allowed",
                  active
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-2 hover:text-ink disabled:text-ink-3 disabled:hover:text-ink-3",
                )}
              >
                <span className="text-sm font-semibold">
                  <span aria-hidden="true" className="type-figure @[18rem]:hidden">
                    {index + 1}
                  </span>
                  <span className="sr-only @[18rem]:not-sr-only">{item.title}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-3">
                  {done ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
                      Done
                    </>
                  ) : active ? (
                    "Now"
                  ) : (
                    "To do"
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function QuickStartStepFields({
  step,
  form,
  setField,
  showErrors,
}: {
  step: number;
  form: QuickStartFormState;
  setField: SetQuickStartField;
  showErrors: boolean;
}) {
  if (step === 0) {
    const titleError = showErrors && !form.title.trim() ? "Give the album a working title." : null;
    const conceptError =
      showErrors && !form.conceptSummary.trim()
        ? "Describe the idea in a sentence or two. You can refine it later."
        : null;
    return (
      <>
        <Field label="Album title" htmlFor="quickstart-title" error={titleError}>
          <input
            id="quickstart-title"
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            className={inputClass}
            placeholder="e.g. Tidewater"
            autoComplete="off"
            aria-required="true"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "quickstart-title-error" : undefined}
          />
        </Field>

        <Field label="Artist" htmlFor="quickstart-artist" hint="Optional. You, your band or a project name.">
          <input
            id="quickstart-artist"
            value={form.artist}
            onChange={(event) => setField("artist", event.target.value)}
            className={inputClass}
            placeholder="e.g. Halcyon"
            autoComplete="off"
            aria-describedby="quickstart-artist-hint"
          />
        </Field>

        <Field
          label="Concept summary"
          htmlFor="quickstart-concept"
          error={conceptError}
          hint="Who is telling the story, what happens, and where it ends up."
        >
          <textarea
            id="quickstart-concept"
            value={form.conceptSummary}
            onChange={(event) => setField("conceptSummary", event.target.value)}
            className={cn(textareaClass, "min-h-32 resize-y")}
            placeholder="What is the emotional or narrative spine of this album?"
            aria-required="true"
            aria-invalid={conceptError ? true : undefined}
            aria-describedby={conceptError ? "quickstart-concept-error" : "quickstart-concept-hint"}
          />
        </Field>

      </>
    );
  }

  if (step === 1) {
    return (
      <>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Narrative arc</legend>
          <div className="mt-2 divide-y divide-line border-y border-line">
            {NARRATIVE_OPTIONS.map((option) => {
              const selected = option.key === form.narrativeStructure;
              return (
                <label
                  key={option.key}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 px-2 py-2.5 transition-colors hover:bg-hover",
                    selected && "bg-selected hover:bg-selected",
                  )}
                >
                  <input
                    type="radio"
                    name="quickstart-narrative"
                    value={option.key}
                    checked={selected}
                    onChange={() => setField("narrativeStructure", option.key)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label="Central themes"
          htmlFor="quickstart-themes"
          hint="Separate with commas or new lines. Tracks pick these up as you write."
        >
          <textarea
            id="quickstart-themes"
            value={form.centralThemesRaw}
            onChange={(event) => setField("centralThemesRaw", event.target.value)}
            className={cn(textareaClass, "resize-y")}
            placeholder="e.g. identity, memory"
            aria-describedby="quickstart-themes-hint"
          />
        </Field>

        <Field
          label="References"
          htmlFor="quickstart-references"
          hint="Optional. Records or songs this album should sit next to, one per line. They're saved to the album's References, where you can add details."
        >
          <textarea
            id="quickstart-references"
            value={form.referenceAlbumsRaw}
            onChange={(event) => setField("referenceAlbumsRaw", event.target.value)}
            className={cn(textareaClass, "resize-y")}
            placeholder={"e.g. Blonde, Frank Ocean\nOK Computer, Radiohead"}
            aria-describedby="quickstart-references-hint"
          />
        </Field>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="quickstart-track-count" className="text-sm font-medium text-ink">
            Track count
          </label>
          {/* Hidden from assistive tech: <output> is a live status, and the slider already
              announces its own value, so the count was read twice. */}
          <output
            htmlFor="quickstart-track-count"
            aria-hidden="true"
            className="type-figure text-xl font-semibold text-ink"
          >
            {form.trackCount}
          </output>
        </div>
        {/* Steppers beside the slider, so the count can also be set a track at a time. At
            either end a stepper is marked unavailable rather than disabled, so focus stays on
            it instead of dropping to the page. */}
        <div className="flex items-center gap-2">
          <IconButton
            label="One track fewer"
            className="border-line-control aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            aria-disabled={form.trackCount <= MIN_TRACKS}
            onClick={() => {
              if (form.trackCount > MIN_TRACKS) setField("trackCount", form.trackCount - 1);
            }}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <TrackCountSlider value={form.trackCount} onChange={(value) => setField("trackCount", value)} />
          <IconButton
            label="One track more"
            className="border-line-control aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            aria-disabled={form.trackCount >= MAX_TRACKS}
            onClick={() => {
              if (form.trackCount < MAX_TRACKS) setField("trackCount", form.trackCount + 1);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
        <p id="quickstart-track-count-hint" className="text-xs leading-relaxed text-ink-3">
          Between {MIN_TRACKS} and {MAX_TRACKS}. You can add or remove tracks later in the Studio.
        </p>
      </div>

      <Field
        label="Track titles (optional)"
        htmlFor="quickstart-track-names"
        hint="One per line, in running order. Leave a line empty to skip a track: a track without a title is called by its number, like Track 3."
      >
        <textarea
          id="quickstart-track-names"
          value={form.trackNamesRaw}
          onChange={(event) => setField("trackNamesRaw", event.target.value)}
          className={cn(textareaClass, "min-h-32 resize-y")}
          aria-describedby="quickstart-track-names-hint"
        />
      </Field>
    </>
  );
}

/**
 * The track-count slider. With a mouse or the keyboard it is the native range input. On a
 * touch screen a finger that lands on it is often starting a scroll of the page, and the
 * native slider jumps to the finger on touchdown, so there the input takes no pointer events:
 * its box leaves vertical pans to the page, and the value follows the finger only once it has
 * clearly moved sideways (`swipeIntent`). A tap or a vertical swipe never changes the count;
 * the ± steppers and the keyboard still do. A mouse, trackpad or pen on such a device drags it
 * at once, as the native slider would (`sliderPointerStart`).
 */
function TrackCountSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const touch = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);

  const follow = (x: number) => {
    const input = inputRef.current;
    if (!input) return;
    const next = rangeValueAt(x, input.getBoundingClientRect(), MIN_TRACKS, MAX_TRACKS);
    if (next !== value) onChange(next);
  };

  return (
    <div
      className="flex min-w-0 flex-1 touch-pan-y"
      onPointerDown={(event) => {
        // Only pointers that reach the box itself: where the input takes pointer events (a
        // fine primary pointer), it handles them natively.
        const start = sliderPointerStart(event.pointerType, event.target === inputRef.current);
        if (start === "native") return;
        touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: start === "drag" };
        if (start === "drag") {
          // A mouse or pen on a touch-first device: moves the slider as the native one would.
          event.preventDefault();
          inputRef.current?.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          follow(event.clientX);
        }
      }}
      onPointerMove={(event) => {
        const start = touch.current;
        if (!start || start.id !== event.pointerId) return;
        if (!start.dragging) {
          const intent = swipeIntent(event.clientX - start.x, event.clientY - start.y);
          if (intent === "undecided") return;
          if (intent === "vertical") {
            // A scroll: the page has it (it cancels the pointer), the count is untouched.
            touch.current = null;
            return;
          }
          start.dragging = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        follow(event.clientX);
      }}
      onPointerUp={() => {
        touch.current = null;
      }}
      onPointerCancel={() => {
        touch.current = null;
      }}
    >
      <input
        ref={inputRef}
        id="quickstart-track-count"
        type="range"
        min={MIN_TRACKS}
        max={MAX_TRACKS}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby="quickstart-track-count-hint"
        className="h-11 w-full min-w-0 cursor-pointer touch-pan-y accent-ink pointer-coarse:pointer-events-none"
      />
    </div>
  );
}

function BlueprintPreview({
  form,
  trackNames,
}: {
  form: QuickStartFormState;
  trackNames: string[];
}) {
  const themes = splitListInput(form.centralThemesRaw);
  const arc = NARRATIVE_OPTIONS.find((option) => option.key === form.narrativeStructure)?.label;
  const title = form.title.trim();
  // The spine shows the album's first six themes, as the album will.
  const spineThemes = Array.from(new Map(themes.map((theme) => [theme.toLowerCase(), theme])).values()).slice(0, 6);
  const previewRows: SpineRow[] = Array.from({ length: form.trackCount }, (_, index) => ({
    trackNumber: index + 1,
    title: openingTrackTitle(trackNames, index),
    sections: 2,
    lyricSections: 0,
    themes: 0,
    themeKeys: [],
    hasNarrative: false,
    writtenHarmony: false,
    narrativePosition: null,
  }));

  return (
    <section aria-labelledby="blueprint-preview-title" className="min-w-0">
      <h2 id="blueprint-preview-title" className="text-lg font-semibold text-ink">
        Blueprint preview
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-ink-2">How the album will open once you save it.</p>

      {/* A size container: the preview title sizes to the panel (never below 30px, the size it
          has at 100% text on a phone), so "Untitled" stays one word at 320px with 200% text. */}
      <div className="@container mt-6 border-t border-line-strong pt-5">
        <p className={cn("type-display break-words text-[length:max(min(1.875rem,30px),min(2.25rem,17cqi))]", title ? "text-ink" : "text-ink-3")}>
          {title || "Untitled album"}
        </p>
        <p className="type-catalog mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
          <span>{form.artist.trim() || "No artist yet"}</span>
          <span aria-hidden="true">·</span>
          <span className="type-figure">{form.trackCount} tracks</span>
          {arc ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{arc}</span>
            </>
          ) : null}
        </p>
        {form.conceptSummary.trim() ? (
          <p className="mt-4 line-clamp-4 max-w-[65ch] whitespace-pre-line break-words text-sm leading-relaxed text-ink-2">
            {form.conceptSummary.trim()}
          </p>
        ) : null}
        {themes.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="sr-only">Themes:</span>
            {themes.map((theme) => (
              <Chip key={theme}>{theme}</Chip>
            ))}
          </div>
        ) : null}
      </div>

      {/* The sequence the album will open with, headed as the album screens head it: with
          themes, the spine (every theme still to be tagged, every lyric still to write); without,
          the numbered titles. The artist fills it in the Studio. */}
      <div className="mt-6">
        <h3 id="blueprint-sequence-title" className="mb-2 text-sm font-semibold text-ink">
          Sequence
        </h3>
        {spineThemes.length ? (
          <ReadOnlySpine rows={previewRows} themes={spineThemes} />
        ) : (
          <ol className="border-t border-line" aria-labelledby="blueprint-sequence-title">
            {previewRows.map((row) => {
              // An untitled position (no line, or a blank one) reads as its number, in Ash Ink.
              const named = Boolean(trackNames[row.trackNumber - 1]);
              return (
                <li key={row.trackNumber} className="flex min-h-11 items-baseline gap-3 border-b border-line py-2.5">
                  <span className="type-figure w-6 shrink-0 text-sm font-semibold text-ink-3">
                    {pad(row.trackNumber)}
                  </span>
                  <span className={cn("min-w-0 break-words text-sm", named ? "text-ink" : "text-ink-3")}>
                    {row.title}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <p className="mt-3 max-w-[65ch] text-xs leading-relaxed text-ink-3">
        Every track opens with an empty verse and chorus over a starter chord loop, there only so
        you can hear it right away; it doesn&apos;t count as written.
      </p>
    </section>
  );
}

/** The first field on a step that blocks moving on, so focus can land on it. */
function firstInvalidField(step: number, form: QuickStartFormState): string | null {
  if (step !== 0) return null;
  if (!form.title.trim()) return "quickstart-title";
  if (!form.conceptSummary.trim()) return "quickstart-concept";
  return null;
}

/** Focus a field after React has rendered its error, so the error is read with it. */
function focusField(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export function QuickStartComposer({
  aiAvailable,
  creditsRemaining,
}: {
  aiAvailable: boolean;
  /** The workspace balance, so the save (which spends credits) can say what's left after. */
  creditsRemaining: number;
}) {
  const router = useRouter();
  const draftIdsRef = useRef<DraftAlbumIds>({
    albumId: newId(),
    songIds: [],
    sectionIds: {},
  });
  // Every step's fields and the current step live in one sessionStorage-backed draft, restored
  // after hydration, so a reload doesn't lose the wizard. Without storage it simply isn't kept.
  const draft = useDraftState<CreateDraft>(CREATE_DRAFT_KEY, {
    initial: () => EMPTY_DRAFT,
    parse: (raw) => {
      const restored = parseCreateDraft(raw);
      if (!restored) return null;
      // Never land on a step whose earlier steps aren't done.
      return canOpenStep(restored.step, restored.form) ? restored : { ...restored, step: 0 };
    },
    isPristine: (value) => isBlankForm(value.form),
  });
  const { form, step, visited } = draft.value;
  const setDraft = draft.setValue;
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Set synchronously, so a second click before the re-render can't send a second create.
  const savingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasMovedRef = useRef(false);

  function setForm(update: (prev: QuickStartFormState) => QuickStartFormState) {
    setDraft((prev) => ({ ...prev, form: update(prev.form) }));
  }

  function setStep(next: number) {
    setDraft((prev) => ({ ...prev, step: next, visited: Math.max(prev.visited, next) }));
  }

  const draftAlbum = useMemo(() => {
    if (!form.title.trim()) return null;
    ensureDraftAlbumIds(draftIdsRef.current, form.trackCount);
    return buildAlbumJson(form, draftIdsRef.current);
  }, [form]);

  const trackNames = useMemo(
    () => trackTitlesByPosition(form.trackNamesRaw, form.trackCount),
    [form.trackNamesRaw, form.trackCount],
  );
  const currentStep = WIZARD_STEPS[step] ?? WIZARD_STEPS[0];
  const lastStep = WIZARD_STEPS.length - 1;

  // Moving between steps puts focus on the new step's heading, so keyboard and screen reader
  // users land at the top of the fields they now have to fill.
  useEffect(() => {
    if (!hasMovedRef.current) return;
    headingRef.current?.focus();
  }, [step]);

  function setField<K extends keyof QuickStartFormState>(key: K, value: QuickStartFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (status) setStatus(null);
  }

  function startOver() {
    draft.reset();
    draftIdsRef.current = { albumId: newId(), songIds: [], sectionIds: {} };
    setShowErrors(false);
    setStatus(null);
    focusField("quickstart-title");
  }

  function goTo(next: number) {
    if (next === step || !canOpenStep(next, form)) return;
    hasMovedRef.current = true;
    setStep(next);
    setShowErrors(false);
    setStatus(null);
  }

  function goNext() {
    if (!getStepValidity(step, form)) {
      setShowErrors(true);
      const invalid = firstInvalidField(step, form);
      if (invalid) {
        // The field's own error says what's missing; focus takes the artist straight there.
        setStatus(null);
        focusField(invalid);
      } else {
        setStatus({ tone: "error", text: "Pick a narrative arc, or add a theme or reference, to continue." });
      }
      return;
    }
    goTo(Math.min(step + 1, lastStep));
  }

  function goBack() {
    goTo(Math.max(step - 1, 0));
  }

  function applyBrainstorm(patch: BrainstormPatch) {
    const restore: Partial<QuickStartFormState> = {};
    const next: Partial<QuickStartFormState> = {};
    if (patch.conceptSummary) {
      restore.conceptSummary = form.conceptSummary;
      next.conceptSummary = patch.conceptSummary;
    }
    if (patch.themes?.length) {
      restore.centralThemesRaw = form.centralThemesRaw;
      next.centralThemesRaw = patch.themes.join(", ");
    }
    if (patch.trackTitles?.length) {
      const titles = patch.trackTitles.slice(0, MAX_TRACKS);
      restore.trackNamesRaw = form.trackNamesRaw;
      restore.trackCount = form.trackCount;
      next.trackNamesRaw = titles.join("\n");
      next.trackCount = Math.min(MAX_TRACKS, Math.max(MIN_TRACKS, titles.length));
    }
    setForm((prev) => ({ ...prev, ...next }));
    setStatus(null);
    return () => setForm((prev) => ({ ...prev, ...restore }));
  }

  async function saveAlbum() {
    if (!getStepValidity(0, form)) {
      hasMovedRef.current = true;
      setStep(0);
      setShowErrors(true);
      setStatus(null);
      const invalid = firstInvalidField(0, form);
      if (invalid) focusField(invalid);
      return;
    }
    if (!getStepValidity(1, form)) {
      hasMovedRef.current = true;
      setStep(1);
      setStatus({
        tone: "error",
        text: "Pick a narrative arc, or add a theme or reference, before saving.",
      });
      return;
    }
    if (!draftAlbum || savingRef.current) return;

    savingRef.current = true;
    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album: draftAlbum }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error?.trim() ||
            "The album couldn't be saved. Check your connection and try again.",
        );
      }
      const saved = (await response.json()) as { id: string };
      // The album exists now; the draft has done its job.
      clearDraft(CREATE_DRAFT_KEY);
      setStatus({ tone: "success", text: "Saved. Opening your album…" });
      // The button stays busy until the album opens: clicked again during the redirect, it
      // would create (and charge for) a second album.
      router.push(`/app/albums/${saved.id}?welcome=1`);
      // Creating the album spent credits; refresh so the layout's credits meter shows it.
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "The album couldn't be saved. Check your connection and try again.";
      setStatus({ tone: "error", text: message });
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const statusTone = status?.tone === "error" ? "danger" : status?.tone === "success" ? "ok" : "neutral";
  const cost: number = CREDIT_COSTS.albumCreate;

  return (
    // Rem-sized container query, not a viewport breakpoint: with enlarged text the preview folds
    // under the form instead of being pushed off-screen.
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 @4xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] @4xl:items-start">
        {/* The side padding follows the column (4% of it, 0.5rem to 1.25rem) rather than the
            text size: at 320px with 200% text the fixed 1rem padding took 64px and cut the
            placeholders short ("e.g. The La"); from about 20em of column it is the usual. The
            md: copy keeps Panel's md:p-5 from putting the fixed padding back. */}
        <Panel className="min-w-0 px-[clamp(0.5rem,4cqi,1.25rem)] md:px-[clamp(0.5rem,4cqi,1.25rem)]">
          {/* Mounted empty, then filled once the draft is restored after hydration, so the
              restore is announced; Start over sits beside it, outside the live region. */}
          <div className={cn("flex flex-wrap items-center gap-x-1", draft.restored && "-mt-1 mb-3")}>
            <LiveStatus message={draft.restored ? "Restored your draft" : null} />
            {draft.restored ? (
              <>
                <span aria-hidden="true" className="text-sm text-ink-2">
                  ·
                </span>
                <Button tone="ghost" className="-my-1 px-2" onClick={startOver}>
                  Start over
                </Button>
              </>
            ) : null}
          </div>

          <WizardProgress step={step} form={form} visited={visited} onStepSelect={goTo} />

          {/* A size container: the step title stays under 16% of the panel, so at 320px with
              200% text "Foundation" fits whole inside it; it never sets smaller than it does
              at 100% text (20px), and from 320px at normal text size nothing changes. */}
          <div className="mt-5 @container">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-[length:max(min(1.25rem,20px),min(1.25rem,16cqi))] font-semibold leading-snug text-ink wrap-break-word"
            >
              {currentStep.title}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              <span className="type-figure">
                Step {step + 1} of {WIZARD_STEPS.length}
              </span>
              {" · "}
              {currentStep.detail}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            <QuickStartStepFields
              step={step}
              form={form}
              setField={setField}
              showErrors={showErrors}
            />
            {/* Stays mounted across steps so a finished brainstorm (and its undo) isn't lost. */}
            <div hidden={step !== 0}>
              <IdeationAi
                concept={form.conceptSummary}
                references={form.referenceAlbumsRaw}
                themes={form.centralThemesRaw}
                trackCount={form.trackCount}
                aiAvailable={aiAvailable}
                creditsRemaining={creditsRemaining}
                onApply={applyBrainstorm}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-4">
            <LiveStatus message={status?.text ?? null} tone={statusTone} />

            {/* One row: Back on the left, the next step on the right. The right column takes
                the rest of the width, so an open spend confirm wraps inside it (question, then
                its buttons, right-aligned) instead of stacking under Back. Bottom-aligned, so
                Back shares a line with the buttons ("Save and continue", Cancel), not with the
                question above them. */}
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
              {step > 0 ? (
                <Button tone="ghost" onClick={goBack}>
                  Back
                </Button>
              ) : (
                <span aria-hidden="true" />
              )}

              <div className="flex min-w-0 justify-end text-right *:justify-end">
                {step < lastStep ? (
                  <Button tone="primary" onClick={goNext}>
                    Continue
                  </Button>
                ) : (
                  <ConfirmSpend
                    cost={cost}
                    remaining={creditsRemaining}
                    actionLabel="Save and continue"
                    onConfirm={saveAlbum}
                    busy={isSaving}
                    tone="primary"
                  >
                    {isSaving ? "Saving…" : `Save and continue · ${cost} ${cost === 1 ? "credit" : "credits"}`}
                  </ConfirmSpend>
                )}
              </div>
            </div>

            {step === lastStep ? (
              <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
                Saving creates the album in your workspace and opens its Overview, where the next
                step to take is one click away.
              </p>
            ) : null}
          </div>
        </Panel>

        <BlueprintPreview form={form} trackNames={trackNames} />
      </div>
    </div>
  );
}
