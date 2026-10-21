"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { RelativeTime } from "@/components/relative-time";
import { LeavePrompt } from "@/components/sound-nav";
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Panel,
  Section,
  LiveStatus,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/ui";
import { REFERENCE_BPM_MAX, REFERENCE_BPM_MIN, referenceBpmProblem } from "@/lib/reference-bpm";
import { REFERENCE_ROLES, referenceRoleLabel } from "@/lib/reference-roles";
import { mergeStringFields, useDraftState, useLeaveGuard } from "@/lib/use-autosave";
import type { AlbumSongOption } from "@/server/album-songs";
import type { AlbumReferenceRecord } from "@/server/references";
import { scrollBehavior } from "@/lib/motion";

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

type Notice = { tone: "ok" | "neutral"; text: string } | null;

type ReferenceResponse = {
  reference: AlbumReferenceRecord;
};

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

/**
 * A reference with nothing but its title, as the create wizard saves the records named there:
 * its row offers "Add details" rather than "Edit".
 */
function isBareReference(reference: AlbumReferenceRecord) {
  return (
    !reference.artist &&
    !reference.notes &&
    !reference.sourceUrl &&
    !reference.targetRole &&
    !reference.bpm &&
    !reference.key &&
    !reference.songTrackNumber &&
    reference.moodTags.length === 0 &&
    reference.arrangementTags.length === 0
  );
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
  // The server's own range (lib/reference-bpm), so the form never sends what it refuses.
  const bpm = referenceBpmProblem(form.bpm, { complete: true });
  if (bpm) return { field: "reference-bpm", message: bpm };
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

function sameForm(left: ReferenceFormState, right: ReferenceFormState) {
  return JSON.stringify(left) === JSON.stringify(right);
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
      <Button ref={confirmRef} tone="danger" className="px-3" busy={busy} onClick={onConfirm}>
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
  // The add form is a draft kept for this tab, so a stray click away never loses it.
  const addDraft = useDraftState<ReferenceFormState>(
    `album-conceptualizer:${albumId}:reference-draft`,
    {
      initial: emptyForm,
      parse: (raw) => (raw ? mergeStringFields(emptyForm(), raw) : null),
      isPristine: (value) => sameForm(value, emptyForm()),
    },
  );
  // null until the viewer opens or closes the add form; a restored draft opens it.
  const [addOpenChoice, setAddOpenChoice] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<{ id: string; form: ReferenceFormState } | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  // BPM is checked as it is typed; a number still below the range ("1" of "118") is only
  // flagged once the field is left or the form is sent.
  const [bpmDone, setBpmDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const editingRecord = editing
    ? (references.find((reference) => reference.id === editing.id) ?? null)
    : null;
  const editDirty = Boolean(
    editing && editingRecord && !sameForm(editing.form, toForm(editingRecord)),
  );
  const addOpen = !editing && (addOpenChoice ?? addDraft.restored);
  const form = editing ? editing.form : addDraft.value;

  const guard = useLeaveGuard({
    when: editDirty || !addDraft.pristine,
    // An add-form draft is kept in the tab; unsaved edits to a saved reference are not.
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

  const trackCount = references.filter((reference) => reference.songTrackNumber).length;
  const wholeAlbumCount = references.length - trackCount;
  const uniqueRoles = new Set(
    references
      .map((reference) => reference.targetRole)
      .filter((role): role is string => Boolean(role)),
  ).size;

  function update<K extends keyof ReferenceFormState>(key: K, value: ReferenceFormState[K]) {
    if (editing) {
      setEditing((current) => (current ? { ...current, form: { ...current.form, [key]: value } } : current));
    } else {
      addDraft.setValue((current) => ({ ...current, [key]: value }));
    }
  }

  function clearFormMessages() {
    setFieldError(null);
    setFormError(null);
    setBpmDone(false);
  }

  function openAdd() {
    clearFormMessages();
    setAddOpenChoice(true);
    focusSoon(FIRST_FIELD_ID);
  }

  function closeAdd() {
    clearFormMessages();
    setAddOpenChoice(false);
    focusSoon(references.length ? "reference-add-trigger" : "reference-add-first");
  }

  function discardDraft() {
    clearFormMessages();
    addDraft.reset();
    setAddOpenChoice(true);
    showNotice("neutral", "Draft discarded.");
    focusSoon(FIRST_FIELD_ID);
  }

  function startEdit(reference: AlbumReferenceRecord) {
    clearFormMessages();
    setEditing({ id: reference.id, form: toForm(reference) });
    focusSoon(FIRST_FIELD_ID);
  }

  function cancelEdit() {
    if (!editing) return;
    clearFormMessages();
    focusSoon(`reference-row-${editing.id}`);
    setEditing(null);
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
      if (problem.field === "reference-bpm") setBpmDone(true);
      document.getElementById(problem.field)?.focus();
      return;
    }
    clearFormMessages();

    const editingId = editing?.id ?? null;
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
      if (editingId) {
        setEditing(null);
        showNotice("ok", "Reference updated.");
      } else {
        addDraft.reset();
        setAddOpenChoice(false);
        showNotice("ok", "Reference added.");
      }
      focusSoon(`reference-row-${saved.id}`);
    } catch (error) {
      setFormError(
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
    setListError(null);
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
      const remaining = references.filter((item) => item.id !== reference.id);
      setReferences(remaining);
      if (editing?.id === reference.id) setEditing(null);
      showNotice("ok", `Reference removed: ${reference.title}.`);
      focusSoon(remaining.length ? "references-list-heading" : "reference-add-first");
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "The reference wasn't removed. Check your connection and try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function renderForm(mode: "add" | "edit") {
    const bpmError = referenceBpmProblem(form.bpm, { complete: bpmDone });
    return (
      <Panel className="@container max-w-3xl">
        <form
          onSubmit={(event) => void submitReference(event)}
          noValidate
          aria-labelledby="reference-form-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="reference-form-title" className="text-base font-semibold text-ink">
                {mode === "edit"
                  ? editingRecord && isBareReference(editingRecord)
                    ? "Add details"
                    : "Edit reference"
                  : "Add a reference"}
              </h3>
              <p className="mt-1 max-w-[65ch] text-sm text-ink-2">
                What this record or song teaches the album: its energy, palette, or mix.
              </p>
              {mode === "add" && addDraft.restored ? (
                <p className="mt-1 max-w-[65ch] text-sm text-ink-3">
                  Draft restored from earlier in this session.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mode === "add" && !addDraft.pristine ? (
                <Button tone="ghost" className="px-3" onClick={discardDraft}>
                  Discard draft
                </Button>
              ) : null}
              <Button
                tone="ghost"
                className="px-3"
                onClick={mode === "edit" ? cancelEdit : closeAdd}
              >
                {mode === "edit" ? "Cancel" : "Close"}
              </Button>
            </div>
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
                <option value="">No particular role</option>
                {REFERENCE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {referenceRoleLabel(role)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Song target"
              htmlFor="reference-song"
              hint="The whole album, or the one track this reference is for."
            >
              <select
                id="reference-song"
                value={form.songTrackNumber}
                onChange={(event) => update("songTrackNumber", event.target.value)}
                className={selectClass}
                aria-describedby="reference-song-hint"
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
              label="BPM"
              htmlFor="reference-bpm"
              hint={`A whole number from ${REFERENCE_BPM_MIN} to ${REFERENCE_BPM_MAX}.`}
              error={bpmError ?? undefined}
            >
              <input
                id="reference-bpm"
                value={form.bpm}
                onChange={(event) => {
                  update("bpm", event.target.value);
                  setBpmDone(false);
                }}
                onBlur={() => setBpmDone(true)}
                className={`${inputClass} type-figure`}
                inputMode="numeric"
                placeholder="e.g. 118"
                autoComplete="off"
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
              error={fieldError?.field === "reference-source-url" ? fieldError.message : undefined}
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

            <Field label="Arrangement tags" htmlFor="reference-arrangement" hint="Separate with commas.">
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
            <Button type="submit" tone="primary" busy={isSubmitting}>
              {isSubmitting ? "Saving…" : mode === "edit" ? "Save reference" : "Add reference"}
            </Button>
            <LiveStatus message={formError} tone="danger" />
          </div>
        </form>
      </Panel>
    );
  }

  const list = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
        <h3
          id="references-list-heading"
          tabIndex={-1}
          className="text-base font-semibold text-ink"
        >
          Saved references
        </h3>
        <p className="text-sm text-ink-2">
          <span className="type-figure text-ink">{references.length}</span> saved ·{" "}
          <span className="type-figure text-ink">{wholeAlbumCount}</span> whole album ·{" "}
          <span className="type-figure text-ink">{trackCount}</span> for one track ·{" "}
          <span className="type-figure text-ink">{uniqueRoles}</span>{" "}
          {uniqueRoles === 1 ? "role" : "roles"}
        </p>
      </div>
      <LiveStatus message={listError} tone="danger" className="mt-3" />
      <ul className="divide-y divide-line">
        {references.map((reference) => {
          const isEditing = editing?.id === reference.id;
          const bare = isBareReference(reference);
          const hasFacts =
            Boolean(reference.bpm) ||
            Boolean(reference.key) ||
            reference.moodTags.length > 0 ||
            reference.arrangementTags.length > 0;
          return (
            <li
              key={reference.id}
              id={`reference-row-${reference.id}`}
              tabIndex={-1}
              aria-current={isEditing ? "true" : undefined}
              className="py-4"
            >
              {isEditing ? (
                renderForm("edit")
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="break-words hyphens-auto text-sm font-semibold text-ink">
                        {reference.title}
                      </p>
                      <p className="mt-0.5 break-words text-sm text-ink-2">
                        {reference.artist ? (
                          <>
                            {reference.artist}
                            {" · "}
                          </>
                        ) : null}
                        {reference.songTrackNumber && reference.songTitle ? (
                          <>
                            Track{" "}
                            <span className="type-figure">{formatTrack(reference.songTrackNumber)}</span>{" "}
                            {reference.songTitle}
                          </>
                        ) : (
                          "Whole album"
                        )}
                      </p>
                    </div>
                    {reference.targetRole ? <Chip>{referenceRoleLabel(reference.targetRole)}</Chip> : null}
                  </div>

                  {hasFacts ? (
                    <dl className="mt-3 flex flex-col gap-2 text-xs">
                      {reference.bpm || reference.key ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <dt className="min-w-24 text-ink-3">Tempo and key</dt>
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
                          <dt className="min-w-24 text-ink-3">Mood</dt>
                          {reference.moodTags.map((tag) => (
                            <dd key={`${reference.id}-mood-${tag}`}>
                              <Chip>{tag}</Chip>
                            </dd>
                          ))}
                        </div>
                      ) : null}
                      {reference.arrangementTags.length ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <dt className="min-w-24 text-ink-3">Arrangement</dt>
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
                    <p className="mt-3 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
                      {reference.notes}
                    </p>
                  ) : bare ? (
                    <p className="mt-2 max-w-[65ch] text-sm text-ink-3">
                      Only the title so far. Add the artist, what it teaches the album, and the track
                      it&apos;s for, if it&apos;s for one.
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
                        tone={bare ? "secondary" : "ghost"}
                        className="px-3"
                        aria-label={bare ? `Add details to ${reference.title}` : `Edit ${reference.title}`}
                        disabled={editDirty}
                        onClick={() => startEdit(reference)}
                      >
                        {bare ? "Add details" : "Edit"}
                      </Button>
                      <DeleteControl
                        itemLabel={reference.title}
                        busy={deletingId === reference.id}
                        onConfirm={() => void deleteReference(reference)}
                      />
                    </div>
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
      title="No references yet"
      action={
        <Button id="reference-add-first" tone="primary" onClick={openAdd}>
          Add your first reference
        </Button>
      }
    >
      <p>
        Add a record or song to anchor the album&apos;s pacing, texture, or mix direction, for the
        whole album or one track. A good place to start:
      </p>
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
        title="References — records and songs this album points to"
        description="One collection of references for the album: records and songs, what each one teaches, and whether it's for the whole album or one track. References named when you set up the album are here too."
        actions={
          references.length && !addOpen && !editing ? (
            <Button id="reference-add-trigger" onClick={openAdd}>
              Add a reference
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-6">
          <LiveStatus message={notice?.text ?? null} tone={notice?.tone === "ok" ? "ok" : "neutral"} />
          {addOpen ? renderForm("add") : null}
          {references.length ? list : addOpen ? null : emptyState}
        </div>
      </Section>

      {references.length ? (
        <Section
          id="reference-prompts"
          title="Good reference prompts"
          description="Questions worth a reference each, if the album doesn't have an answer yet."
        >
          <ul className="max-w-[65ch] divide-y divide-line border-y border-line text-sm text-ink-2">
            {REFERENCE_PROMPTS.map((prompt) => (
              <li key={prompt} className="py-3">
                {prompt}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <LeavePrompt
        guard={guard}
        message={
          editDirty
            ? "Your changes to this reference aren't saved yet. If you leave now, they'll be lost."
            : "This browser won't keep your reference draft. If you leave now, it will be lost."
        }
      />
    </div>
  );
}
