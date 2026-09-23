"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { LeavePrompt } from "@/components/sound-nav";
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Panel,
  Section,
  StatusMessage,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/ui";
import { mergeStringFields, useDraftState, useLeaveGuard } from "@/lib/use-autosave";
import type { AlbumSongOption } from "@/server/album-songs";
import type { AlbumRoughDemoRecord } from "@/server/rough-demos";
import type { RoughDemoCollection, RoughDemoReview } from "@/server/rough-demo-review";

type RoughDemoFormState = {
  title: string;
  sourceKind: string;
  songTrackNumber: string;
  externalUrl: string;
  captureNotes: string;
  sonicTraits: string;
  lyricalFragments: string;
  nextActions: string;
  localFile: {
    name: string;
    size_bytes: number | null;
    mime_type: string | null;
    duration_seconds: number | null;
  } | null;
};

type Notice = { tone: "ok" | "neutral"; text: string } | null;

const SOURCE_OPTIONS = [
  "voice-memo",
  "phone-demo",
  "rehearsal",
  "riff-sketch",
  "acoustic-pass",
  "hook-sketch",
] as const;

const INPUT_CHECKLIST = [
  "Capture what the demo proves, not just what it is.",
  "Tag the track if you already know where the idea belongs.",
  "Write the next move while the idea is still fresh.",
];

const FIRST_FIELD_ID = "demo-file";

function getRoughDemoSourceLabel(sourceKind: string) {
  return (
    {
      "voice-memo": "Voice memo",
      "phone-demo": "Phone demo",
      rehearsal: "Rehearsal",
      "riff-sketch": "Riff sketch",
      "acoustic-pass": "Acoustic pass",
      "hook-sketch": "Hook sketch",
    }[sourceKind] ?? sourceKind
  );
}

function emptyForm(): RoughDemoFormState {
  return {
    title: "",
    sourceKind: "voice-memo",
    songTrackNumber: "",
    externalUrl: "",
    captureNotes: "",
    sonicTraits: "",
    lyricalFragments: "",
    nextActions: "",
    localFile: null,
  };
}

function splitList(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(/\r?\n|,/g)
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function toForm(demo: AlbumRoughDemoRecord): RoughDemoFormState {
  return {
    title: demo.title,
    sourceKind: demo.source_kind,
    songTrackNumber: demo.song_track_number ? String(demo.song_track_number) : "",
    externalUrl: demo.external_url ?? "",
    captureNotes: demo.capture_notes ?? "",
    sonicTraits: demo.sonic_traits.join(", "),
    lyricalFragments: demo.lyrical_fragments.join(", "),
    nextActions: demo.next_actions.join(", "),
    localFile: demo.local_file
      ? {
          name: demo.local_file.name,
          size_bytes: demo.local_file.size_bytes ?? null,
          mime_type: demo.local_file.mime_type ?? null,
          duration_seconds: demo.local_file.duration_seconds ?? null,
        }
      : null,
  };
}

function sortDemos(demos: AlbumRoughDemoRecord[]) {
  return demos.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

function formatBytes(value: number | null) {
  if (!value) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "audio/x-wav" → "WAV": the file kind an artist recognizes, not the media type. */
function formatFileKind(mime: string | null) {
  if (!mime) return null;
  const subtype = mime.split("/")[1] ?? "";
  const kind = subtype.replace(/^x-/, "").replace(/^mpeg$/, "mp3").toUpperCase();
  return kind || null;
}

function formatTrack(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

function buildBody(form: RoughDemoFormState) {
  return {
    title: form.title.trim(),
    source_kind: form.sourceKind,
    song_track_number: form.songTrackNumber ? Number(form.songTrackNumber) : null,
    external_url: form.externalUrl.trim() || null,
    capture_notes: form.captureNotes.trim() || null,
    sonic_traits: splitList(form.sonicTraits),
    lyrical_fragments: splitList(form.lyricalFragments),
    next_actions: splitList(form.nextActions),
    local_file: form.localFile,
  };
}

function validate(form: RoughDemoFormState): { field: string; message: string } | null {
  if (!form.title.trim()) {
    return { field: "demo-title", message: "Add a demo title before saving." };
  }
  const url = form.externalUrl.trim();
  if (url) {
    try {
      new URL(url);
    } catch {
      return { field: "demo-url", message: "Paste the full link, starting with https://" };
    }
  }
  return null;
}

function indexReviews(reviews: RoughDemoReview[]) {
  return Object.fromEntries(reviews.map((review) => [review.demoId, review])) as Record<
    string,
    RoughDemoReview
  >;
}

function getPayloadError(payload: RoughDemoCollection | { error?: string } | null, fallback: string) {
  return payload && "error" in payload && payload.error ? payload.error : fallback;
}

function readinessTone(label: RoughDemoReview["readinessLabel"]) {
  if (label === "Ready") return "ok" as const;
  if (label === "Needs shape") return "warn" as const;
  return "neutral" as const;
}

function sameForm(left: RoughDemoFormState, right: RoughDemoFormState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** A stored draft back into form state; the file's facts survive, the file itself can't. */
function parseDraft(raw: unknown): RoughDemoFormState | null {
  if (!raw || typeof raw !== "object") return null;
  const form = mergeStringFields(emptyForm(), raw);
  const file = (raw as { localFile?: unknown }).localFile;
  if (file && typeof file === "object" && typeof (file as { name?: unknown }).name === "string") {
    const { name, size_bytes, mime_type, duration_seconds } = file as Record<string, unknown>;
    form.localFile = {
      name: name as string,
      size_bytes: typeof size_bytes === "number" ? size_bytes : null,
      mime_type: typeof mime_type === "string" ? mime_type : null,
      duration_seconds: typeof duration_seconds === "number" ? duration_seconds : null,
    };
  }
  return form;
}

/** Smooth scrolling, unless the viewer asked the system for less motion. */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** A success notice that clears itself. Its live region is always rendered, so it is heard. */
function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  function show(tone: "ok" | "neutral", text: string) {
    if (timer.current) window.clearTimeout(timer.current);
    setNotice({ tone, text });
    timer.current = window.setTimeout(() => setNotice(null), 6000);
  }
  return [notice, show] as const;
}

/** Delete with a confirm step in place, so a stray tap can't remove a saved demo. */
function DeleteControl({
  itemLabel,
  busy,
  onConfirm,
}: {
  itemLabel: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (wasConfirming.current) triggerRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        tone="danger"
        className="px-3"
        aria-label={`Delete ${itemLabel}`}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <div role="group" aria-label={`Delete ${itemLabel}?`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">Delete this demo?</span>
      <Button ref={confirmRef} tone="danger" className="px-3" disabled={busy} onClick={onConfirm}>
        {busy ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button tone="ghost" className="px-3" disabled={busy} onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </div>
  );
}

function ReviewBlock({ demoId, review }: { demoId: string; review: RoughDemoReview }) {
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink">Structured review</h4>
          <p className="mt-0.5 text-sm text-ink">{review.headline}</p>
        </div>
        <Chip tone={readinessTone(review.readinessLabel)}>
          <span className="type-figure">{review.signalScore}/100</span> · {review.readinessLabel}
        </Chip>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-3">Suggested placement</dt>
          <dd className="mt-0.5 max-w-[65ch] text-sm leading-relaxed text-ink-2">
            {review.suggestedPlacement}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Track fit</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-ink-2">
            {review.recommendedTrack ? (
              <>
                Track <span className="type-figure">{review.recommendedTrack.trackNumber}</span>:{" "}
                {review.recommendedTrack.title}
              </>
            ) : (
              "Still album-wide until a track becomes obvious."
            )}
          </dd>
          {review.recommendedTrack ? (
            <dd className="mt-0.5 text-xs leading-relaxed text-ink-3">
              {review.recommendedTrack.reason}
            </dd>
          ) : null}
        </div>
      </dl>

      {review.focusTags.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {review.focusTags.map((item) => (
            <li key={`${demoId}-focus-${item}`}>
              <Chip>{item}</Chip>
            </li>
          ))}
        </ul>
      ) : null}

      {review.nextMoves.length ? (
        <p className="mt-3 max-w-[65ch] text-sm text-ink-2">
          <span className="text-ink-3">Next:</span> {review.nextMoves.join(" · ")}
        </p>
      ) : null}

      {review.concerns.length ? (
        <p className="mt-1 max-w-[65ch] text-sm text-ink-2">
          <span className="text-warn">Watch:</span> {review.concerns.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

export function AlbumRoughDemoWorkspace({
  albumId,
  initialDemos,
  initialReviews,
  songOptions,
}: {
  albumId: string;
  initialDemos: AlbumRoughDemoRecord[];
  initialReviews: RoughDemoReview[];
  songOptions: AlbumSongOption[];
}) {
  const [demos, setDemos] = useState(() => sortDemos(initialDemos));
  const [reviewsById, setReviewsById] = useState(() => indexReviews(initialReviews));
  // The add form is a draft kept for this tab, so a stray click away never loses it.
  const addDraft = useDraftState<RoughDemoFormState>(`album-conceptualizer:${albumId}:demo-draft`, {
    initial: emptyForm,
    parse: parseDraft,
    isPristine: (value) => sameForm(value, emptyForm()),
  });
  // null until the viewer opens or closes the add form; a restored draft opens it.
  const [addOpenChoice, setAddOpenChoice] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<{ id: string; form: RoughDemoFormState } | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<string | null>(null);

  const editingRecord = editing ? (demos.find((demo) => demo.id === editing.id) ?? null) : null;
  const editDirty = Boolean(editing && editingRecord && !sameForm(editing.form, toForm(editingRecord)));
  const addOpen = !editing && (addOpenChoice ?? addDraft.restored);
  const form = editing ? editing.form : addDraft.value;

  const guard = useLeaveGuard({
    when: editDirty || !addDraft.pristine,
    // An add-form draft is kept in the tab; unsaved edits to a saved demo are not.
    beforeLeave: () => !editDirty && addDraft.persist(),
  });

  // Move focus once the element it belongs to has rendered.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    const element = document.getElementById(id);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
  });

  function focusSoon(id: string) {
    pendingFocus.current = id;
  }

  function applyCollection(payload: RoughDemoCollection) {
    setDemos(sortDemos(payload.demos));
    setReviewsById(indexReviews(payload.reviews));
  }

  function setFormState(next: (current: RoughDemoFormState) => RoughDemoFormState) {
    if (editing) {
      setEditing((current) => (current ? { ...current, form: next(current.form) } : current));
    } else {
      addDraft.setValue(next);
    }
  }

  function update<K extends keyof RoughDemoFormState>(key: K, value: RoughDemoFormState[K]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function clearFormMessages() {
    setFieldError(null);
    setFormError(null);
  }

  function openAdd() {
    clearFormMessages();
    setAddOpenChoice(true);
    focusSoon(FIRST_FIELD_ID);
  }

  function closeAdd() {
    clearFormMessages();
    setAddOpenChoice(false);
    focusSoon(demos.length ? "demo-add-trigger" : "demo-add-first");
  }

  function discardDraft() {
    clearFormMessages();
    addDraft.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAddOpenChoice(true);
    showNotice("neutral", "Draft discarded.");
    focusSoon(FIRST_FIELD_ID);
  }

  function startEdit(demo: AlbumRoughDemoRecord) {
    clearFormMessages();
    setEditing({ id: demo.id, form: toForm(demo) });
    focusSoon("demo-title");
  }

  function cancelEdit() {
    if (!editing) return;
    clearFormMessages();
    focusSoon(`demo-row-${editing.id}`);
    setEditing(null);
  }

  function errorProps(fieldId: string) {
    return fieldError?.field === fieldId
      ? { "aria-invalid": true, "aria-describedby": `${fieldId}-error` }
      : {};
  }

  async function saveDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate(form);
    if (problem) {
      setFieldError(problem);
      document.getElementById(problem.field)?.focus();
      return;
    }
    clearFormMessages();

    const editingId = editing?.id ?? null;
    const knownIds = new Set(demos.map((demo) => demo.id));
    setIsSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/albums/${albumId}/rough-demos/${editingId}` : `/api/albums/${albumId}/rough-demos`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildBody(form)),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | RoughDemoCollection
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("demos" in payload) || !("reviews" in payload)) {
        throw new Error(
          getPayloadError(payload, "The demo didn't save. Check your connection and try again."),
        );
      }

      applyCollection(payload);
      const savedId = editingId ?? payload.demos.find((demo) => !knownIds.has(demo.id))?.id ?? null;
      if (editingId) {
        setEditing(null);
        showNotice("ok", "Demo updated.");
      } else {
        addDraft.reset();
        if (fileInputRef.current) fileInputRef.current.value = "";
        setAddOpenChoice(false);
        showNotice("ok", "Demo added.");
      }
      focusSoon(savedId ? `demo-row-${savedId}` : "demos-list-heading");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The demo didn't save. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDemo(demo: AlbumRoughDemoRecord) {
    setDeletingId(demo.id);
    setListError(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/rough-demos/${demo.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | RoughDemoCollection
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("demos" in payload) || !("reviews" in payload)) {
        throw new Error(
          getPayloadError(payload, "The demo wasn't removed. Check your connection and try again."),
        );
      }
      applyCollection(payload);
      if (editing?.id === demo.id) setEditing(null);
      showNotice("ok", `Demo removed: ${demo.title}.`);
      focusSoon(payload.demos.length ? "demos-list-heading" : "demo-add-first");
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "The demo wasn't removed. Check your connection and try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFileChange(file: File | null) {
    if (!file) {
      update("localFile", null);
      return;
    }

    const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
    setFormState((current) => ({
      ...current,
      title: current.title || fallbackTitle,
      localFile: {
        name: file.name,
        size_bytes: file.size || null,
        mime_type: file.type || null,
        duration_seconds: null,
      },
    }));

    if (typeof window === "undefined") return;

    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
      URL.revokeObjectURL(objectUrl);
      setFormState((current) => {
        if (!current.localFile || current.localFile.name !== file.name) return current;
        return { ...current, localFile: { ...current.localFile, duration_seconds: duration } };
      });
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
    };
    audio.src = objectUrl;
  }

  const targetedCount = demos.filter((demo) => demo.song_track_number).length;
  const importedCount = demos.filter((demo) => demo.local_file).length;
  const reviews = demos
    .map((demo) => reviewsById[demo.id])
    .filter((review): review is RoughDemoReview => Boolean(review));
  const readyCount = reviews.filter((review) => review.readyForHandoff).length;
  const unassignedCount = reviews.filter((review) => review.targetMode === "unassigned").length;

  const fileFacts = form.localFile
    ? [
        formatDuration(form.localFile.duration_seconds),
        formatBytes(form.localFile.size_bytes),
        formatFileKind(form.localFile.mime_type),
      ].filter(Boolean)
    : [];

  function renderForm(mode: "add" | "edit") {
    return (
      <Panel className="@container max-w-3xl">
        <form onSubmit={(event) => void saveDemo(event)} noValidate aria-labelledby="demo-form-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="demo-form-title" className="text-base font-semibold text-ink">
                {mode === "edit" ? "Edit rough demo" : "Add a rough demo"}
              </h3>
              <p className="mt-1 max-w-[65ch] text-sm text-ink-2">
                Turn a memo, riff, or rehearsal pass into a structured next step.
              </p>
              {mode === "add" && addDraft.restored ? (
                <p className="mt-1 max-w-[65ch] text-sm text-ink-3">
                  Draft restored from earlier in this session.
                  {form.localFile ? " Pick the audio file again to re-read its length." : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mode === "add" && !addDraft.pristine ? (
                <Button tone="ghost" className="px-3" onClick={discardDraft}>
                  Discard draft
                </Button>
              ) : null}
              <Button tone="ghost" className="px-3" onClick={mode === "edit" ? cancelEdit : closeAdd}>
                {mode === "edit" ? "Cancel" : "Close"}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 @md:grid-cols-2">
            <Field
              label="Local rough demo file"
              htmlFor="demo-file"
              hint="Read on this device for length and size only. The audio isn't uploaded."
              className="@md:col-span-2"
            >
              <input
                ref={fileInputRef}
                id="demo-file"
                type="file"
                accept="audio/*"
                onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
                aria-describedby="demo-file-hint"
                className="block w-full min-w-0 cursor-pointer text-sm text-ink-2 file:mr-3 file:inline-flex file:min-h-11 file:cursor-pointer file:items-center file:rounded file:border file:border-solid file:border-line-strong file:bg-transparent file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-hover"
              />
            </Field>

            {form.localFile ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line py-2 @md:col-span-2">
                <p className="min-w-0 break-words text-sm text-ink">
                  {form.localFile.name}
                  {fileFacts.length ? (
                    <span className="type-figure text-ink-2"> · {fileFacts.join(" · ")}</span>
                  ) : null}
                </p>
                <Button
                  tone="ghost"
                  className="px-3"
                  aria-label={`Remove file ${form.localFile.name}`}
                  onClick={() => {
                    update("localFile", null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Remove file
                </Button>
              </div>
            ) : null}

            <Field
              label="Demo title"
              htmlFor="demo-title"
              error={fieldError?.field === "demo-title" ? fieldError.message : undefined}
            >
              <input
                id="demo-title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                className={inputClass}
                placeholder="e.g. Hallway chorus memo"
                autoComplete="off"
                {...errorProps("demo-title")}
              />
            </Field>

            <Field label="Source kind" htmlFor="demo-source">
              <select
                id="demo-source"
                value={form.sourceKind}
                onChange={(event) => update("sourceKind", event.target.value)}
                className={selectClass}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getRoughDemoSourceLabel(option)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Song target" htmlFor="demo-song">
              <select
                id="demo-song"
                value={form.songTrackNumber}
                onChange={(event) => update("songTrackNumber", event.target.value)}
                className={selectClass}
              >
                <option value="">Whole album</option>
                {songOptions.map((song) => (
                  <option key={`${song.trackNumber}-${song.title}`} value={String(song.trackNumber)}>
                    {formatTrack(song.trackNumber)} · {song.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="External URL"
              htmlFor="demo-url"
              error={fieldError?.field === "demo-url" ? fieldError.message : undefined}
            >
              <input
                id="demo-url"
                type="url"
                value={form.externalUrl}
                onChange={(event) => update("externalUrl", event.target.value)}
                className={inputClass}
                placeholder="https://…"
                {...errorProps("demo-url")}
              />
            </Field>

            <Field label="What this demo captures" htmlFor="demo-capture" className="@md:col-span-2">
              <textarea
                id="demo-capture"
                value={form.captureNotes}
                onChange={(event) => update("captureNotes", event.target.value)}
                rows={4}
                className={textareaClass}
                placeholder="e.g. The verse melody is weak, but the chorus rhythm and last line feel worth keeping."
              />
            </Field>

            <Field label="Sonic traits" htmlFor="demo-traits" hint="Separate with commas.">
              <textarea
                id="demo-traits"
                value={form.sonicTraits}
                onChange={(event) => update("sonicTraits", event.target.value)}
                rows={3}
                className={textareaClass}
                placeholder="e.g. muted guitar, handclap pulse, breathy hook"
                aria-describedby="demo-traits-hint"
              />
            </Field>

            <Field label="Lyrical fragments" htmlFor="demo-fragments" hint="Separate with commas.">
              <textarea
                id="demo-fragments"
                value={form.lyricalFragments}
                onChange={(event) => update("lyricalFragments", event.target.value)}
                rows={3}
                className={textareaClass}
                placeholder="e.g. missed the exit, static glow, room 309"
                aria-describedby="demo-fragments-hint"
              />
            </Field>

            <Field
              label="Next moves"
              htmlFor="demo-next"
              hint="Separate with commas."
              className="@md:col-span-2"
            >
              <textarea
                id="demo-next"
                value={form.nextActions}
                onChange={(event) => update("nextActions", event.target.value)}
                rows={3}
                className={textareaClass}
                placeholder="e.g. rewrite verse 1, test a slower tempo, move this hook to Track 3"
                aria-describedby="demo-next-hint"
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="submit" tone="primary" disabled={isSaving}>
              {isSaving ? "Saving…" : mode === "edit" ? "Update demo" : "Add demo"}
            </Button>
            {formError ? <StatusMessage tone="danger">{formError}</StatusMessage> : null}
          </div>
        </form>
      </Panel>
    );
  }

  const list = (
    <div className="min-w-0">
      <div className="border-b border-line pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3
            id="demos-list-heading"
            tabIndex={-1}
            className="text-base font-semibold text-ink"
          >
            Captured demos
          </h3>
          <p className="text-sm text-ink-2">
            <span className="type-figure text-ink">{demos.length}</span>{" "}
            {demos.length === 1 ? "demo" : "demos"} ·{" "}
            <span className="type-figure text-ink">{targetedCount}</span> song-targeted ·{" "}
            <span className="type-figure text-ink">{importedCount}</span> local{" "}
            {importedCount === 1 ? "import" : "imports"}
          </p>
        </div>
        <p className="mt-1 text-sm text-ink-2">
          <span className="type-figure text-ink">{readyCount}</span> handoff-ready ·{" "}
          <span className="type-figure text-ink">{unassignedCount}</span>{" "}
          {unassignedCount === 1 ? "still needs" : "still need"} a track decision
        </p>
      </div>
      {listError ? (
        <StatusMessage tone="danger" className="mt-3">
          {listError}
        </StatusMessage>
      ) : null}
      <ul className="@container divide-y divide-line">
        {demos.map((demo) => {
          const review = reviewsById[demo.id];
          const isEditing = editing?.id === demo.id;

          return (
            <li
              key={demo.id}
              id={`demo-row-${demo.id}`}
              tabIndex={-1}
              aria-current={isEditing ? "true" : undefined}
              className="py-4"
            >
              {isEditing ? (
                renderForm("edit")
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="break-words hyphens-auto text-sm font-semibold text-ink">{demo.title}</p>
                    <p className="mt-0.5 break-words text-sm text-ink-2">
                      {getRoughDemoSourceLabel(demo.source_kind)}
                      {demo.song_track_number ? (
                        <>
                          {" · Track "}
                          <span className="type-figure">{formatTrack(demo.song_track_number)}</span>
                        </>
                      ) : (
                        " · Whole album"
                      )}
                      {demo.local_file?.name ? ` · ${demo.local_file.name}` : ""}
                    </p>
                  </div>

                  {demo.capture_notes ? (
                    <p className="mt-3 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
                      {demo.capture_notes}
                    </p>
                  ) : null}

                  {demo.sonic_traits.length ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {demo.sonic_traits.slice(0, 4).map((item) => (
                        <li key={`${demo.id}-trait-${item}`}>
                          <Chip>{item}</Chip>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {review ? <ReviewBlock demoId={demo.id} review={review} /> : null}

                  {demo.next_actions.length ? (
                    <p className="mt-3 max-w-[65ch] text-sm text-ink-2">
                      <span className="text-ink-3">Saved next moves:</span>{" "}
                      {demo.next_actions.join(" · ")}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      tone="ghost"
                      className="px-3"
                      aria-label={`Edit ${demo.title}`}
                      disabled={editDirty}
                      onClick={() => startEdit(demo)}
                    >
                      Edit
                    </Button>
                    <DeleteControl
                      itemLabel={demo.title}
                      busy={deletingId === demo.id}
                      onConfirm={() => void deleteDemo(demo)}
                    />
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const emptyState = (
    <EmptyState
      title="No rough demos yet"
      action={
        <Button id="demo-add-first" tone="primary" onClick={openAdd}>
          Add your first demo
        </Button>
      }
    >
      <p>
        Save a voice memo, riff sketch, or rehearsal pass before it gets lost. A structured review
        appears as soon as you save one.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {INPUT_CHECKLIST.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </EmptyState>
  );

  return (
    <div className="flex flex-col gap-10">
      <Section
        id="rough-demos"
        title="Capture the voice memo before the good idea disappears"
        description="Save rough demo details, notes, and next moves. Local audio files are read on this device for their length and size only; they aren't uploaded or stored."
        actions={
          demos.length && !addOpen && !editing ? (
            <Button id="demo-add-trigger" onClick={openAdd}>
              Add a demo
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-6">
          <p
            role="status"
            className={notice ? (notice.tone === "ok" ? "text-sm text-ok" : "text-sm text-ink-2") : "sr-only"}
          >
            {notice?.text}
          </p>
          {addOpen ? renderForm("add") : null}
          {demos.length ? list : addOpen ? null : emptyState}
        </div>
      </Section>

      {demos.length ? (
        <Section
          id="demo-checklist"
          title="Good input checklist"
          description="What makes a rough demo useful the next time you open the session."
        >
          <ul className="max-w-[65ch] divide-y divide-line border-y border-line text-sm text-ink-2">
            {INPUT_CHECKLIST.map((item) => (
              <li key={item} className="py-3">
                {item}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <LeavePrompt
        guard={guard}
        message={
          editDirty
            ? "Your changes to this demo aren't saved yet. If you leave now, they'll be lost."
            : "This browser won't keep your demo draft. If you leave now, it will be lost."
        }
      />
    </div>
  );
}
