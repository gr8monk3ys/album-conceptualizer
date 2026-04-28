"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { IdeationAi } from "@/components/ideation-ai";

type NarrativeStructure = "three-act" | "hero's-journey" | "circular" | "non-linear";

type QuickStartFormState = {
  title: string;
  artist: string;
  conceptSummary: string;
  narrativeStructure: NarrativeStructure;
  centralThemesRaw: string;
  referenceAlbumsRaw: string;
  trackCount: number;
  trackNamesRaw: string;
};

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
    detail: "Capture the core idea and why this album exists.",
  },
  {
    key: "direction",
    title: "Direction",
    detail: "Lock the narrative shape, themes, and references.",
  },
  {
    key: "tracklist",
    title: "Tracklist",
    detail: "Set track count, seed titles, and generate the first blueprint.",
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
    description: "Setup, collision, and resolution across the release.",
  },
  {
    key: "hero's-journey",
    label: "Hero's journey",
    description: "Transformation arc with a clear emotional climb.",
  },
  {
    key: "circular",
    label: "Circular",
    description: "Ends where it began, but with new meaning.",
  },
  {
    key: "non-linear",
    label: "Non-linear",
    description: "Fragments, flashbacks, and theme-first sequencing.",
  },
];

const COMMON_PROGRESSIONS: Array<{ key: string; chords: string[] }> = [
  { key: "C", chords: ["C", "G", "Am", "F"] },
  { key: "A minor", chords: ["Am", "F", "C", "G"] },
  { key: "G", chords: ["G", "D", "Em", "C"] },
  { key: "D minor", chords: ["Dm", "Bb", "F", "C"] },
];

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

function splitTrackNames(raw: string): string[] {
  return splitListInput(raw);
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
    const progression = COMMON_PROGRESSIONS[index % COMMON_PROGRESSIONS.length] ?? COMMON_PROGRESSIONS[0];
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
      sections: [
        {
          id: verseId,
          section_type: "verse",
          order: 1,
          lyrics: "[Verse line 1]\n[Verse line 2]\n[Verse line 3]\n[Verse line 4]",
          chord_progression: progression.chords,
        },
        {
          id: chorusId,
          section_type: "chorus",
          order: 2,
          lyrics: "[Chorus line 1]\n[Chorus line 2]\n[Chorus line 3]\n[Chorus line 4]",
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

  return form.trackCount >= 4;
}

function getStatusClassName(tone: StatusTone) {
  if (tone === "error") return "text-[rgba(255,200,200,0.95)]";
  if (tone === "success") return "text-[var(--ok)]";
  return "text-[var(--muted2)]";
}

function WizardProgress({
  step,
  onStepSelect,
}: {
  step: number;
  onStepSelect: (step: number) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {WIZARD_STEPS.map((item, index) => {
        const active = index === step;
        const complete = index < step;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onStepSelect(index)}
            className={`rounded-2xl border px-3 py-3 text-left ${
              active
                ? "border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)]"
                : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted2)]">
              {complete ? "Done" : `0${index + 1}`}
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--text)]">{item.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.detail}</div>
          </button>
        );
      })}
    </div>
  );
}

function QuickStartStepFields({
  step,
  form,
  setField,
}: {
  step: number;
  form: QuickStartFormState;
  setField: SetQuickStartField;
}) {
  if (step === 0) {
    return (
      <>
        <label className="block">
          <div className="text-xs font-semibold text-[var(--text)]">Album title</div>
          <input
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
            placeholder="e.g., The Last Summer"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-[var(--text)]">Artist</div>
          <input
            value={form.artist}
            onChange={(event) => setField("artist", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
            placeholder="e.g., The Storytellers"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-[var(--text)]">Concept summary</div>
          <textarea
            value={form.conceptSummary}
            onChange={(event) => setField("conceptSummary", event.target.value)}
            className="mt-2 min-h-[130px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
            placeholder="What is the emotional or narrative spine of this album?"
          />
        </label>
      </>
    );
  }

  if (step === 1) {
    return (
      <>
        <div>
          <div className="text-xs font-semibold text-[var(--text)]">Narrative structure</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {NARRATIVE_OPTIONS.map((option) => {
              const selected = option.key === form.narrativeStructure;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setField("narrativeStructure", option.key)}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    selected
                      ? "border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)]"
                      : "border-[var(--border)] bg-[rgba(255,255,255,0.03)]"
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--text)]">{option.label}</div>
                  <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <div className="text-xs font-semibold text-[var(--text)]">Central themes</div>
          <textarea
            value={form.centralThemesRaw}
            onChange={(event) => setField("centralThemesRaw", event.target.value)}
            className="mt-2 min-h-[100px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
            placeholder="memory, loss, rebirth"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-[var(--text)]">Reference albums</div>
          <textarea
            value={form.referenceAlbumsRaw}
            onChange={(event) => setField("referenceAlbumsRaw", event.target.value)}
            className="mt-2 min-h-[90px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
            placeholder="One per line or comma-separated"
          />
        </label>
      </>
    );
  }

  return (
    <>
      <label htmlFor="quickstart-track-count" className="block">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-[var(--text)]">Track count</div>
          <div className="text-xs text-[var(--muted)]">{form.trackCount}</div>
        </div>
        <input
          id="quickstart-track-count"
          type="range"
          min={4}
          max={20}
          value={form.trackCount}
          onChange={(event) => setField("trackCount", Number(event.target.value))}
          aria-label="Track count"
          className="mt-2 w-full accent-[var(--accent)]"
        />
      </label>

      <label className="block">
        <div className="text-xs font-semibold text-[var(--text)]">Track names (optional)</div>
        <textarea
          value={form.trackNamesRaw}
          onChange={(event) => setField("trackNamesRaw", event.target.value)}
          className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
          placeholder="One per line or comma-separated"
        />
      </label>

      <IdeationAi
        concept={form.conceptSummary}
        references={form.referenceAlbumsRaw}
        themes={form.centralThemesRaw}
        trackCount={form.trackCount}
      />

      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-4">
        <div className="text-xs text-[var(--muted2)]">After you save</div>
        <div className="mt-2 space-y-2 text-sm text-[var(--muted)]">
          <div>1. Review the Bible to see themes and story structure across tracks.</div>
          <div>2. Make one Studio pass and save your first real edits.</div>
          <div>3. Export a handoff pack or publish the blueprint for remix.</div>
        </div>
      </div>
    </>
  );
}

function PreviewStatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-4">
      <div className="text-xs text-[var(--muted2)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">{value}</div>
    </div>
  );
}

function BlueprintPreview({
  draftAlbum,
  form,
  trackNames,
  jsonText,
  onCopy,
  onDownload,
}: {
  draftAlbum: ReturnType<typeof buildAlbumJson> | null;
  form: QuickStartFormState;
  trackNames: string[];
  jsonText: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Blueprint preview</div>
          <div className="text-sm font-semibold text-[var(--text)]">album.json</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            disabled={!draftAlbum}
            className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={!draftAlbum}
            className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.12)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PreviewStatCard label="Tracks" value={form.trackCount} />
        <PreviewStatCard label="Themes" value={splitListInput(form.centralThemesRaw).length} />
        <PreviewStatCard
          label="References"
          value={splitListInput(form.referenceAlbumsRaw).length}
        />
        <PreviewStatCard
          label="Arc"
          value={
            <span className="text-sm">
              {NARRATIVE_OPTIONS.find((option) => option.key === form.narrativeStructure)?.label}
            </span>
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-4">
          <div className="text-xs text-[var(--muted2)]">Track preview</div>
          <div className="mt-3 space-y-2">
            {Array.from({ length: form.trackCount }, (_, index) => {
              const title = trackNames[index] || `Track ${index + 1}`;
              return (
                <div
                  key={`${index + 1}-${title}`}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2"
                >
                  <div className="text-[10px] text-[var(--muted2)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
                </div>
              );
            }).slice(0, 6)}
            {form.trackCount > 6 ? (
              <div className="text-xs text-[var(--muted2)]">
                + {form.trackCount - 6} more tracks in the generated scaffold
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(0,0,0,0.35)] p-3">
          <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted)]">
            {jsonText || "Add an album title to see the live blueprint preview."}
          </pre>
        </div>
      </div>
    </section>
  );
}

export function QuickStartComposer() {
  const router = useRouter();
  const draftIdsRef = useRef<DraftAlbumIds>({
    albumId: newId(),
    songIds: [],
    sectionIds: {},
  });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<QuickStartFormState>({
    title: "",
    artist: "",
    conceptSummary: "",
    narrativeStructure: "three-act",
    centralThemesRaw: "identity, memory",
    referenceAlbumsRaw: "",
    trackCount: 10,
    trackNamesRaw: "",
  });
  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const draftAlbum = useMemo(() => {
    if (!form.title.trim()) return null;
    ensureDraftAlbumIds(draftIdsRef.current, form.trackCount);
    return buildAlbumJson(form, draftIdsRef.current);
  }, [form]);

  const deferredAlbum = useDeferredValue(draftAlbum);
  const jsonText = useMemo(() => {
    if (!deferredAlbum) return "";
    return JSON.stringify(deferredAlbum, null, 2);
  }, [deferredAlbum]);

  const trackNames = useMemo(() => splitTrackNames(form.trackNamesRaw), [form.trackNamesRaw]);
  const currentStep = WIZARD_STEPS[step] ?? WIZARD_STEPS[0];

  function setField<K extends keyof QuickStartFormState>(key: K, value: QuickStartFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (status) setStatus(null);
  }

  function goNext() {
    if (!getStepValidity(step, form)) {
      setStatus({
        tone: "error",
        text:
          step === 0
            ? "Add an album title and concept summary to continue."
            : "Add a narrative shape, theme, or reference before continuing.",
      });
      return;
    }
    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
    if (status) setStatus(null);
  }

  function downloadAlbumJson() {
    if (!jsonText) return;
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "album.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus({ tone: "info", text: "Downloaded album.json." });
  }

  async function copyToClipboard() {
    if (!jsonText) return;
    await navigator.clipboard.writeText(jsonText);
    setStatus({ tone: "success", text: "Copied album.json to clipboard." });
  }

  async function saveAlbum() {
    if (!draftAlbum) {
      setStatus({ tone: "error", text: "Add an album title first." });
      return;
    }
    if (!getStepValidity(0, form)) {
      setStep(0);
      setStatus({ tone: "error", text: "Add an album title and concept summary first." });
      return;
    }
    if (!getStepValidity(1, form)) {
      setStep(1);
      setStatus({
        tone: "error",
        text: "Add a narrative shape, theme, or reference before saving.",
      });
      return;
    }

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
        throw new Error(body?.error || "Failed to save project.");
      }
      const saved = (await response.json()) as { id: string };
      setStatus({ tone: "success", text: "Saved to workspace." });
      router.push(`/app/albums/${saved.id}?welcome=1`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save project.";
      setStatus({ tone: "error", text: message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--muted2)]">First project</div>
            <div className="text-lg font-semibold tracking-tight text-[var(--text)]">
              Build your album blueprint
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">{currentStep.detail}</div>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
            Step {step + 1} / {WIZARD_STEPS.length}
          </div>
        </div>

        <WizardProgress step={step} onStepSelect={setStep} />

        <div className="mt-5 space-y-4">
          <QuickStartStepFields step={step} form={form} setField={setField} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className={`text-xs ${status ? getStatusClassName(status.tone) : "text-[var(--muted2)]"}`}>
            {status?.text ?? "This blueprint stays compatible with the Python Album model."}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>

            {step < WIZARD_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-4 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(255,62,165,0.15)] hover:brightness-110"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={saveAlbum}
                disabled={!draftAlbum || isSaving}
                className="rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-4 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(255,62,165,0.15)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Save and continue"}
              </button>
            )}
          </div>
        </div>
      </section>

      <BlueprintPreview
        draftAlbum={draftAlbum}
        form={form}
        trackNames={trackNames}
        jsonText={jsonText}
        onCopy={() => void copyToClipboard()}
        onDownload={downloadAlbumJson}
      />
    </div>
  );
}
