"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { RelativeTime } from "@/components/relative-time";
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
import type { AlbumSongOption } from "@/server/album-songs";
import type { AlbumReferenceRecord } from "@/server/references";

type ReferenceFormState = {
  title: string;
  artist: string;
  sourceUrl: string;
  notes: string;
  targetRole: string;
  bpm: string;
  key: string;
  moodTagsRaw: string;
  arrangementTagsRaw: string;
  songTrackNumber: string;
};

type Status = { tone: "ok" | "danger" | "neutral"; text: string } | null;

type ReferenceResponse = {
  reference: AlbumReferenceRecord;
};

const ROLE_OPTIONS = [
  "album-world",
  "opener",
  "closer",
  "chorus-energy",
  "vocal-texture",
  "mix-palette",
  "bridge-contrast",
] as const;

const REFERENCE_PROMPTS = [
  "What should the opener feel like in the first 20 seconds?",
  "What mix or vocal texture should the chorus aim for?",
  "Which song best teaches the closer how to land?",
];

const FIRST_FIELD_ID = "reference-title";

function emptyForm(): ReferenceFormState {
  return {
    title: "",
    artist: "",
    sourceUrl: "",
    notes: "",
    targetRole: "",
    bpm: "",
    key: "",
    moodTagsRaw: "",
    arrangementTagsRaw: "",
    songTrackNumber: "",
  };
}

function splitTagInput(raw: string) {
  return raw
    .split(/\r?\n|,/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatRole(role: string | null) {
  if (!role) return "Album-wide";
  return role
    .split("-")
    .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
    .join(" ");
}

function formatTrack(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

function sortReferences(references: AlbumReferenceRecord[]) {
  return references.slice().sort((left, right) => {
    if (left.updatedAt === right.updatedAt) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function buildBody(form: ReferenceFormState) {
  const trimmedUrl = form.sourceUrl.trim();
  return {
    title: form.title.trim(),
    artist: form.artist.trim() || undefined,
    sourceUrl: trimmedUrl || undefined,
    notes: form.notes.trim() || undefined,
    targetRole: form.targetRole || undefined,
    bpm: form.bpm.trim() ? Number(form.bpm.trim()) : undefined,
    key: form.key.trim() || undefined,
    moodTags: splitTagInput(form.moodTagsRaw),
    arrangementTags: splitTagInput(form.arrangementTagsRaw),
    songTrackNumber: form.songTrackNumber ? Number(form.songTrackNumber) : undefined,
  };
}

/** A plain-words reason the form can't be sent yet, tied to the field that needs fixing. */
function validate(form: ReferenceFormState): { field: string; message: string } | null {
  if (!form.title.trim()) {
    return { field: "reference-title", message: "Add a reference title before saving." };
  }
  const bpm = form.bpm.trim();
  if (bpm && !(Number(bpm) > 0)) {
    return { field: "reference-bpm", message: "BPM should be a number, like 118." };
  }
  const url = form.sourceUrl.trim();
  if (url) {
    try {
      new URL(url);
    } catch {
      return {
        field: "reference-source-url",
        message: "Paste the full link, starting with https://",
      };
    }
  }
  return null;
}

function toForm(reference: AlbumReferenceRecord): ReferenceFormState {
  return {
    title: reference.title,
    artist: reference.artist ?? "",
    sourceUrl: reference.sourceUrl ?? "",
    notes: reference.notes ?? "",
    targetRole: reference.targetRole ?? "",
    bpm: reference.bpm ? String(reference.bpm) : "",
    key: reference.key ?? "",
    moodTagsRaw: reference.moodTags.join(", "),
    arrangementTagsRaw: reference.arrangementTags.join(", "),
    songTrackNumber: reference.songTrackNumber ? String(reference.songTrackNumber) : "",
  };
}

/** Status text that clears itself after a success; errors stay until the next action. */
function useStatus() {
  const [status, setStatus] = useState<Status>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  function show(tone: "ok" | "danger" | "neutral", text: string) {
    if (timer.current) window.clearTimeout(timer.current);
    setStatus({ tone, text });
    if (tone !== "danger") timer.current = window.setTimeout(() => setStatus(null), 4000);
  }
  return [status, show] as const;
}

/** Delete with a confirm step in place, so a stray tap can't remove a saved reference. */
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
      <span className="text-sm text-ink-2">Delete this reference?</span>
      <Button ref={confirmRef} tone="danger" className="px-3" disabled={busy} onClick={onConfirm}>
        {busy ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button tone="ghost" className="px-3" disabled={busy} onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </div>
  );
}

export function AlbumReferencesWorkspace({
  albumId,
  initialReferences,
  songOptions,
}: {
  albumId: string;
  initialReferences: AlbumReferenceRecord[];
  songOptions: AlbumSongOption[];
}) {
  const [references, setReferences] = useState<AlbumReferenceRecord[]>(() =>
    sortReferences(initialReferences),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReferenceFormState>(() => emptyForm());
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [formStatus, showFormStatus] = useStatus();
  const [listStatus, showListStatus] = useStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const songScopedCount = references.filter((reference) => reference.songTrackNumber).length;
  const uniqueRoles = new Set(
    references
      .map((reference) => reference.targetRole)
      .filter((role): role is string => Boolean(role)),
  ).size;

  function update<K extends keyof ReferenceFormState>(key: K, value: ReferenceFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function focusForm(fieldId = FIRST_FIELD_ID) {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById(fieldId)?.focus({ preventScroll: true });
  }

  function resetEditor() {
    setEditingId(null);
    setForm(emptyForm());
    setFieldError(null);
  }

  function errorProps(fieldId: string) {
    return fieldError?.field === fieldId
      ? { "aria-invalid": true, "aria-describedby": `${fieldId}-error` }
      : {};
  }

  async function submitReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate(form);
    if (problem) {
      setFieldError(problem);
      document.getElementById(problem.field)?.focus();
      return;
    }
    setFieldError(null);

    const wasEditing = Boolean(editingId);
    setIsSubmitting(true);
    try {
      const response = await fetch(
        editingId
          ? `/api/albums/${albumId}/references/${editingId}`
          : `/api/albums/${albumId}/references`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildBody(form)),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | ReferenceResponse
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("reference" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "The reference didn't save. Check your connection and try again.",
        );
      }

      const saved = payload.reference;
      setReferences((current) => {
        const next = current.filter((reference) => reference.id !== saved.id);
        next.unshift(saved);
        return sortReferences(next);
      });
      showFormStatus("ok", wasEditing ? "Reference updated." : "Reference added.");
      resetEditor();
    } catch (error) {
      showFormStatus(
        "danger",
        error instanceof Error
          ? error.message
          : "The reference didn't save. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteReference(reference: AlbumReferenceRecord) {
    setDeletingId(reference.id);
    try {
      const response = await fetch(`/api/albums/${albumId}/references/${reference.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(
          payload?.error ?? "The reference wasn't removed. Check your connection and try again.",
        );
      }
      setReferences((current) => current.filter((item) => item.id !== reference.id));
      if (editingId === reference.id) {
        resetEditor();
      }
      showListStatus("ok", `Reference removed: ${reference.title}.`);
    } catch (error) {
      showListStatus(
        "danger",
        error instanceof Error
          ? error.message
          : "The reference wasn't removed. Check your connection and try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const list = references.length ? (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
        <h3 className="text-base font-semibold text-ink">Saved references</h3>
        <p className="text-sm text-ink-2">
          <span className="type-figure text-ink">{references.length}</span> saved ·{" "}
          <span className="type-figure text-ink">{songScopedCount}</span> song-specific ·{" "}
          <span className="type-figure text-ink">{uniqueRoles}</span>{" "}
          {uniqueRoles === 1 ? "role" : "roles"}
        </p>
      </div>
      {listStatus ? (
        <StatusMessage tone={listStatus.tone} className="mt-3">
          {listStatus.text}
        </StatusMessage>
      ) : null}
      <ul className="divide-y divide-line">
        {references.map((reference) => {
          const isEditing = editingId === reference.id;
          const hasFacts =
            Boolean(reference.bpm) ||
            Boolean(reference.key) ||
            reference.moodTags.length > 0 ||
            reference.arrangementTags.length > 0;
          return (
            <li
              key={reference.id}
              aria-current={isEditing ? "true" : undefined}
              className={isEditing ? "-mx-3 bg-selected px-3 py-4" : "py-4"}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-ink">{reference.title}</p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {reference.artist || "Artist not set"}
                    {" · "}
                    {reference.songTrackNumber && reference.songTitle ? (
                      <>
                        Track <span className="type-figure">{formatTrack(reference.songTrackNumber)}</span>{" "}
                        {reference.songTitle}
                      </>
                    ) : (
                      "Whole album"
                    )}
                  </p>
                </div>
                <Chip>{formatRole(reference.targetRole)}</Chip>
              </div>

              {hasFacts ? (
                <dl className="mt-3 flex flex-col gap-2 text-xs">
                  {reference.bpm || reference.key ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <dt className="w-24 shrink-0 text-ink-3">Tempo and key</dt>
                      {reference.bpm ? (
                        <dd>
                          <Chip className="type-figure">{reference.bpm} BPM</Chip>
                        </dd>
                      ) : null}
                      {reference.key ? (
                        <dd>
                          <Chip>{reference.key}</Chip>
                        </dd>
                      ) : null}
                    </div>
                  ) : null}
                  {reference.moodTags.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <dt className="w-24 shrink-0 text-ink-3">Mood</dt>
                      {reference.moodTags.map((tag) => (
                        <dd key={`${reference.id}-mood-${tag}`}>
                          <Chip>{tag}</Chip>
                        </dd>
                      ))}
                    </div>
                  ) : null}
                  {reference.arrangementTags.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <dt className="w-24 shrink-0 text-ink-3">Arrangement</dt>
                      {reference.arrangementTags.map((tag) => (
                        <dd key={`${reference.id}-arrangement-${tag}`}>
                          <Chip>{tag}</Chip>
                        </dd>
                      ))}
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {reference.notes ? (
                <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-ink-2">
                  {reference.notes}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p className="text-xs text-ink-3">
                  Updated <RelativeTime date={reference.updatedAt} />
                  {reference.sourceUrl ? (
                    <>
                      {" · "}
                      <a
                        href={reference.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center text-ink-2 underline underline-offset-4 hover:text-ink"
                      >
                        Open source
                        <span className="sr-only"> for {reference.title} (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    tone="ghost"
                    className="px-3"
                    aria-label={`Edit ${reference.title}`}
                    onClick={() => {
                      setEditingId(reference.id);
                      setForm(toForm(reference));
                      setFieldError(null);
                      showFormStatus("neutral", `Editing ${reference.title}.`);
                      focusForm();
                    }}
                  >
                    Edit
                  </Button>
                  <DeleteControl
                    itemLabel={reference.title}
                    busy={deletingId === reference.id}
                    onConfirm={() => void deleteReference(reference)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  ) : (
    <EmptyState
      title="No references yet"
      action={
        <Button onClick={() => focusForm()}>Add your first reference</Button>
      }
    >
      <p>Add one to anchor the album&apos;s pacing, texture, or mix direction. A good place to start:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {REFERENCE_PROMPTS.map((prompt) => (
          <li key={prompt}>{prompt}</li>
        ))}
      </ul>
    </EmptyState>
  );

  return (
    <div className="flex flex-col gap-10">
      <Section
        id="references"
        title="Save the tracks you keep pointing at"
        description="Capture reference songs, what each one teaches the album, and whether it belongs to the whole project or a specific track. Build the album's sonic map before the DAW session gets messy."
      >
        <div className="@container">
          <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @3xl:items-start">
            {list}

            <Panel ref={panelRef} className="@container scroll-mt-24">
              <form onSubmit={(event) => void submitReference(event)} noValidate>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink">
                      {editingId ? "Edit reference" : "Add a reference"}
                    </h3>
                    <p className="mt-1 text-sm text-ink-2">
                      Source the record&apos;s energy, palette, and mix targets.
                    </p>
                  </div>
                  {editingId ? (
                    <Button tone="ghost" className="px-3" onClick={resetEditor}>
                      Cancel
                    </Button>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 @md:grid-cols-2">
                  <Field
                    label="Reference title"
                    htmlFor="reference-title"
                    error={fieldError?.field === "reference-title" ? fieldError.message : undefined}
                  >
                    <input
                      id="reference-title"
                      value={form.title}
                      onChange={(event) => update("title", event.target.value)}
                      className={inputClass}
                      placeholder="Track title"
                      autoComplete="off"
                      {...errorProps("reference-title")}
                    />
                  </Field>

                  <Field label="Artist" htmlFor="reference-artist">
                    <input
                      id="reference-artist"
                      value={form.artist}
                      onChange={(event) => update("artist", event.target.value)}
                      className={inputClass}
                      placeholder="Artist or band"
                      autoComplete="off"
                    />
                  </Field>

                  <Field label="Target role" htmlFor="reference-role">
                    <select
                      id="reference-role"
                      value={form.targetRole}
                      onChange={(event) => update("targetRole", event.target.value)}
                      className={selectClass}
                    >
                      <option value="">Album-wide</option>
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {formatRole(role)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Song target" htmlFor="reference-song">
                    <select
                      id="reference-song"
                      value={form.songTrackNumber}
                      onChange={(event) => update("songTrackNumber", event.target.value)}
                      className={selectClass}
                    >
                      <option value="">Whole album</option>
                      {songOptions.map((song) => (
                        <option
                          key={`${song.trackNumber}-${song.title}`}
                          value={String(song.trackNumber)}
                        >
                          {formatTrack(song.trackNumber)} · {song.title}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="BPM"
                    htmlFor="reference-bpm"
                    error={fieldError?.field === "reference-bpm" ? fieldError.message : undefined}
                  >
                    <input
                      id="reference-bpm"
                      value={form.bpm}
                      onChange={(event) => update("bpm", event.target.value)}
                      className={`${inputClass} type-figure`}
                      inputMode="numeric"
                      placeholder="e.g. 118"
                      {...errorProps("reference-bpm")}
                    />
                  </Field>

                  <Field label="Key" htmlFor="reference-key">
                    <input
                      id="reference-key"
                      value={form.key}
                      onChange={(event) => update("key", event.target.value)}
                      className={inputClass}
                      placeholder="e.g. C minor"
                      autoComplete="off"
                    />
                  </Field>

                  <Field
                    label="Source URL"
                    htmlFor="reference-source-url"
                    className="@md:col-span-2"
                    error={
                      fieldError?.field === "reference-source-url" ? fieldError.message : undefined
                    }
                  >
                    <input
                      id="reference-source-url"
                      type="url"
                      value={form.sourceUrl}
                      onChange={(event) => update("sourceUrl", event.target.value)}
                      className={inputClass}
                      placeholder="https://open.spotify.com/…"
                      {...errorProps("reference-source-url")}
                    />
                  </Field>

                  <Field label="Mood tags" htmlFor="reference-mood" hint="Separate with commas.">
                    <input
                      id="reference-mood"
                      value={form.moodTagsRaw}
                      onChange={(event) => update("moodTagsRaw", event.target.value)}
                      className={inputClass}
                      placeholder="e.g. cinematic, tense, urgent"
                      aria-describedby="reference-mood-hint"
                      autoComplete="off"
                    />
                  </Field>

                  <Field
                    label="Arrangement tags"
                    htmlFor="reference-arrangement"
                    hint="Separate with commas."
                  >
                    <input
                      id="reference-arrangement"
                      value={form.arrangementTagsRaw}
                      onChange={(event) => update("arrangementTagsRaw", event.target.value)}
                      className={inputClass}
                      placeholder="e.g. wide drums, stacked vocals"
                      aria-describedby="reference-arrangement-hint"
                      autoComplete="off"
                    />
                  </Field>

                  <Field
                    label="Why this reference matters"
                    htmlFor="reference-notes"
                    className="@md:col-span-2"
                  >
                    <textarea
                      id="reference-notes"
                      value={form.notes}
                      onChange={(event) => update("notes", event.target.value)}
                      className={textareaClass}
                      rows={4}
                      placeholder="What exactly should this track teach the album?"
                    />
                  </Field>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button type="submit" tone="primary" disabled={isSubmitting}>
                    {isSubmitting ? "Saving…" : editingId ? "Update reference" : "Add reference"}
                  </Button>
                  {formStatus ? (
                    <StatusMessage tone={formStatus.tone}>{formStatus.text}</StatusMessage>
                  ) : null}
                </div>
              </form>
            </Panel>
          </div>
        </div>
      </Section>

      {references.length ? (
        <Section
          id="reference-prompts"
          title="Good reference prompts"
          description="Questions worth a reference each, if the album doesn't have an answer yet."
        >
          <ul className="max-w-[68ch] divide-y divide-line border-y border-line text-sm text-ink-2">
            {REFERENCE_PROMPTS.map((prompt) => (
              <li key={prompt} className="py-3">
                {prompt}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
