"use client";

import { useState } from "react";

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

type StatusTone = "error" | "success" | "info";

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

function sortReferences(references: AlbumReferenceRecord[]) {
  return references.slice().sort((left, right) => {
    if (left.updatedAt === right.updatedAt) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function getStatusClassName(tone: StatusTone) {
  if (tone === "error") return "text-[rgba(255,200,200,0.95)]";
  if (tone === "success") return "text-[var(--ok)]";
  return "text-[var(--muted2)]";
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
  const [statusText, setStatusText] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const songScopedCount = references.filter((reference) => reference.songTrackNumber).length;
  const uniqueRoles = new Set(
    references
      .map((reference) => reference.targetRole)
      .filter((role): role is string => Boolean(role)),
  ).size;

  function setStatus(tone: StatusTone, text: string) {
    setStatusTone(tone);
    setStatusText(text);
  }

  function resetEditor() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function submitReference() {
    const body = buildBody(form);
    if (!body.title) {
      setStatus("error", "Add a reference title before saving.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        editingId
          ? `/api/albums/${albumId}/references/${editingId}`
          : `/api/albums/${albumId}/references`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | ReferenceResponse
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("reference" in payload)) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Save failed.");
      }

      setReferences((current) => {
        const next = current.filter((reference) => reference.id !== payload.reference.id);
        next.unshift(payload.reference);
        return sortReferences(next);
      });
      setStatus("success", editingId ? "Reference updated." : "Reference added.");
      resetEditor();
    } catch (error) {
      setStatus("error", error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSubmitting(false);
      window.setTimeout(() => setStatusText(""), 1800);
    }
  }

  async function deleteReference(referenceId: string) {
    setDeletingId(referenceId);
    try {
      const response = await fetch(`/api/albums/${albumId}/references/${referenceId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Delete failed.");
      }
      setReferences((current) => current.filter((reference) => reference.id !== referenceId));
      if (editingId === referenceId) {
        resetEditor();
      }
      setStatus("success", "Reference removed.");
    } catch (error) {
      setStatus("error", error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeletingId(null);
      window.setTimeout(() => setStatusText(""), 1800);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Reference workspace</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">
            Save the tracks you keep pointing at
          </div>
          <div className="mt-2 max-w-[72ch] text-sm text-[var(--muted)]">
            Capture reference songs, what each one teaches the album, and whether it belongs to
            the whole project or a specific track.
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted2)]">
                {editingId ? "Edit reference" : "Add reference"}
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                Source the record&apos;s energy, palette, and mix targets
              </div>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetEditor}
                className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Reference title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="Track title"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Artist</span>
              <input
                value={form.artist}
                onChange={(event) => setForm((current) => ({ ...current, artist: event.target.value }))}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="Artist or band"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Target role</span>
              <select
                value={form.targetRole}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetRole: event.target.value }))
                }
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              >
                <option value="">Album-wide</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Song target</span>
              <select
                value={form.songTrackNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, songTrackNumber: event.target.value }))
                }
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              >
                <option value="">Whole album</option>
                {songOptions.map((song) => (
                  <option key={`${song.trackNumber}-${song.title}`} value={String(song.trackNumber)}>
                    {String(song.trackNumber).padStart(2, "0")} · {song.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">BPM</span>
              <input
                value={form.bpm}
                onChange={(event) => setForm((current) => ({ ...current, bpm: event.target.value }))}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                inputMode="numeric"
                placeholder="118"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Key</span>
              <input
                value={form.key}
                onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="C minor"
              />
            </label>

            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Source URL</span>
              <input
                value={form.sourceUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sourceUrl: event.target.value }))
                }
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="https://open.spotify.com/..."
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Mood tags</span>
              <input
                value={form.moodTagsRaw}
                onChange={(event) =>
                  setForm((current) => ({ ...current, moodTagsRaw: event.target.value }))
                }
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="cinematic, tense, urgent"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Arrangement tags</span>
              <input
                value={form.arrangementTagsRaw}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    arrangementTagsRaw: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="wide drums, stacked vocals"
              />
            </label>

            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Why this reference matters</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[120px] rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="What exactly should this track teach the album?"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void submitReference()}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : editingId ? "Update reference" : "Add reference"}
            </button>
            {statusText ? (
              <div className={`text-xs ${getStatusClassName(statusTone)}`}>{statusText}</div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {references.length ? (
            references.map((reference) => (
              <div
                key={reference.id}
                className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--text)]">
                        {reference.title}
                      </div>
                      <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]">
                        {formatRole(reference.targetRole)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted2)]">
                      {reference.artist || "Artist not set"}
                      {reference.songTrackNumber && reference.songTitle
                        ? ` · Track ${String(reference.songTrackNumber).padStart(2, "0")} ${reference.songTitle}`
                        : " · Whole album"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(reference.id);
                        setForm(toForm(reference));
                        setStatus("info", "Editing reference.");
                      }}
                      className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[10px] font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === reference.id}
                      onClick={() => void deleteReference(reference.id)}
                      className="rounded-full border border-[rgba(255,72,72,0.30)] bg-[rgba(255,72,72,0.10)] px-3 py-2 text-[10px] font-semibold text-[var(--bad)] hover:bg-[rgba(255,72,72,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === reference.id ? "Removing..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {reference.bpm ? (
                    <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold text-[var(--muted2)]">
                      {reference.bpm} BPM
                    </div>
                  ) : null}
                  {reference.key ? (
                    <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold text-[var(--muted2)]">
                      {reference.key}
                    </div>
                  ) : null}
                  {reference.moodTags.map((tag) => (
                    <div
                      key={`${reference.id}-mood-${tag}`}
                      className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(109,94,252,0.10)] px-2 py-1 text-[10px] font-semibold text-[var(--muted)]"
                    >
                      {tag}
                    </div>
                  ))}
                  {reference.arrangementTags.map((tag) => (
                    <div
                      key={`${reference.id}-arrangement-${tag}`}
                      className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,62,165,0.10)] px-2 py-1 text-[10px] font-semibold text-[var(--muted)]"
                    >
                      {tag}
                    </div>
                  ))}
                </div>

                {reference.notes ? (
                  <div className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                    {reference.notes}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted2)]">
                  <div>Updated {new Date(reference.updatedAt).toLocaleString()}</div>
                  {reference.sourceUrl ? (
                    <a
                      href={reference.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[var(--text)]"
                    >
                      Open source
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              No references yet. Add one to anchor the album&apos;s pacing, texture, or mix
              direction.
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Reference coverage</div>
          <div className="mt-2 grid grid-cols-1 gap-3">
            {[
              { label: "Saved references", value: references.length },
              { label: "Song-specific", value: songScopedCount },
              { label: "Distinct roles", value: uniqueRoles },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3"
              >
                <div className="text-[11px] text-[var(--muted2)]">{item.label}</div>
                <div className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Good reference prompts</div>
          <div className="mt-2 space-y-2 text-sm text-[var(--muted)]">
            <div>1. What should the opener feel like in the first 20 seconds?</div>
            <div>2. What mix or vocal texture should the chorus aim for?</div>
            <div>3. Which song best teaches the closer how to land?</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
