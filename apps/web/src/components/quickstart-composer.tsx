"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { ConfirmSpend } from "@/components/confirm-spend";
import { IdeationAi, type BrainstormPatch } from "@/components/ideation-ai";
import { Button, Chip, Field, Panel, StatusMessage, inputClass, textareaClass } from "@/components/ui";
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
import { clearDraft, useDraftState } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

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
    title: "Tracklist",
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

/** Track titles are one per line: a title may contain a comma. */
function splitTrackNames(raw: string): string[] {
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
  const trackNames = splitTrackNames(input.trackNamesRaw);
  const centralThemes = splitListInput(input.centralThemesRaw);
  const referenceAlbums = splitListInput(input.referenceAlbumsRaw);

  const songs = Array.from({ length: input.trackCount }, (_, index) => {
    const trackNumber = index + 1;
    const title = trackNames[index] || `Track ${trackNumber}`;
    const progression = progressionFor(index);
    const [verseId, chorusId] = ids.sectionIds[index] ?? [newId(), newId()];

    return {
      id: ids.songIds[index] ?? newId(),
      title,
      track_number: trackNumber,
      key: progression.key,
      tempo: 120,
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
        splitListInput(form.referenceAlbumsRaw).length > 0,
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
    <nav aria-label="Setup steps">
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
                <span className="max-w-full break-words text-sm font-semibold hyphens-auto">{item.title}</span>
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
            placeholder="e.g. The Last Summer"
            autoComplete="off"
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
            placeholder="e.g. The Storytellers"
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
          label="Reference albums"
          htmlFor="quickstart-references"
          hint="Optional. Records this one should sit next to, one per line or separated by commas."
        >
          <textarea
            id="quickstart-references"
            value={form.referenceAlbumsRaw}
            onChange={(event) => setField("referenceAlbumsRaw", event.target.value)}
            className={cn(textareaClass, "resize-y")}
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
          <output htmlFor="quickstart-track-count" className="type-figure text-xl font-semibold text-ink">
            {form.trackCount}
          </output>
        </div>
        <input
          id="quickstart-track-count"
          type="range"
          min={MIN_TRACKS}
          max={MAX_TRACKS}
          value={form.trackCount}
          onChange={(event) => setField("trackCount", Number(event.target.value))}
          aria-describedby="quickstart-track-count-hint"
          className="h-11 w-full cursor-pointer accent-ink"
        />
        <p id="quickstart-track-count-hint" className="text-xs leading-relaxed text-ink-3">
          Between {MIN_TRACKS} and {MAX_TRACKS}. You can add or remove tracks later in the Studio.
        </p>
      </div>

      <Field
        label="Track titles (optional)"
        htmlFor="quickstart-track-names"
        hint="One per line, in running order. Tracks without a title are called Track 1, Track 2 and so on."
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

  return (
    <section aria-labelledby="blueprint-preview-title" className="min-w-0">
      <h2 id="blueprint-preview-title" className="text-lg font-semibold text-ink">
        Blueprint preview
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-ink-2">How the album will open once you save it.</p>

      <div className="mt-6 border-t border-line-strong pt-5">
        <p className={cn("type-display break-words text-3xl md:text-4xl", title ? "text-ink" : "text-ink-3")}>
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

      <ol className="mt-6 border-t border-line" aria-label="Tracklist">
        {Array.from({ length: form.trackCount }, (_, index) => {
          const trackTitle = trackNames[index];
          const progression = progressionFor(index);
          return (
            <li key={index} className="flex items-baseline gap-4 border-b border-line py-2.5">
              <span className="type-figure w-9 shrink-0 text-2xl font-semibold text-ink-3">{pad(index + 1)}</span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "break-words text-sm font-semibold",
                    trackTitle ? "text-ink" : "text-ink-3",
                  )}
                >
                  {trackTitle || `Track ${index + 1}`}
                </p>
                <p className="mt-0.5 text-xs text-ink-3">
                  Verse and chorus to write
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">; </span>
                  starting-point chords to replace:{" "}
                  <span className="type-figure">{progression.chords.join(" ")}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 max-w-[65ch] text-xs leading-relaxed text-ink-3">
        Each track starts with an empty verse and chorus. The chord loops are only there so you can
        hear a track right away; replace them when you write.
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

  const trackNames = useMemo(() => splitTrackNames(form.trackNamesRaw), [form.trackNamesRaw]);
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
    if (!draftAlbum) return;

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
      router.push(`/app/albums/${saved.id}?welcome=1`);
      // Creating the album spent credits; refresh so the layout's credits meter shows it.
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "The album couldn't be saved. Check your connection and try again.";
      setStatus({ tone: "error", text: message });
    } finally {
      setIsSaving(false);
    }
  }

  const statusTone = status?.tone === "error" ? "danger" : status?.tone === "success" ? "ok" : "neutral";
  const cost = CREDIT_COSTS.albumCreate;

  return (
    // Rem-sized container query, not a viewport breakpoint: with enlarged text the preview folds
    // under the form instead of being pushed off-screen.
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 @4xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] @4xl:items-start">
        <Panel className="min-w-0">
          {draft.restored ? (
            <p role="status" className="-mt-1 mb-3 flex flex-wrap items-center gap-x-1 text-sm text-ink-2">
              <span>Restored your draft</span>
              <span aria-hidden="true">·</span>
              <Button tone="ghost" className="-my-1 px-2" onClick={startOver}>
                Start over
              </Button>
            </p>
          ) : null}

          <WizardProgress step={step} form={form} visited={visited} onStepSelect={goTo} />

          <div className="mt-5">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-ink">
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
            {status ? <StatusMessage tone={statusTone}>{status.text}</StatusMessage> : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {step > 0 ? (
                <Button tone="ghost" onClick={goBack}>
                  Back
                </Button>
              ) : (
                <span aria-hidden="true" />
              )}

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
                  {isSaving ? "Saving…" : `Save and continue · ${cost} credits`}
                </ConfirmSpend>
              )}
            </div>

            {step === lastStep ? (
              <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
                Saving creates the album in your workspace and opens it, ready for a first writing
                pass in the Studio.
              </p>
            ) : null}
          </div>
        </Panel>

        <BlueprintPreview form={form} trackNames={trackNames} />
      </div>
    </div>
  );
}
