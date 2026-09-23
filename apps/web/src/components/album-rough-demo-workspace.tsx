"use client";

import { useState } from "react";

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

const SOURCE_OPTIONS = [
  "voice-memo",
  "phone-demo",
  "rehearsal",
  "riff-sketch",
  "acoustic-pass",
  "hook-sketch",
] as const;

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
  return demos
    .slice()
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

function formatBytes(value: number | null) {
  if (!value) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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

function indexReviews(reviews: RoughDemoReview[]) {
  return Object.fromEntries(reviews.map((review) => [review.demoId, review])) as Record<
    string,
    RoughDemoReview
  >;
}

function getPayloadError(payload: RoughDemoCollection | { error?: string } | null, fallback: string) {
  return payload && "error" in payload && payload.error ? payload.error : fallback;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoughDemoFormState>(() => emptyForm());
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function applyCollection(payload: RoughDemoCollection) {
    setDemos(sortDemos(payload.demos));
    setReviewsById(indexReviews(payload.reviews));
  }

  async function saveDemo() {
    const body = buildBody(form);
    if (!body.title) {
      setStatus("Add a demo title before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/albums/${albumId}/rough-demos/${editingId}` : `/api/albums/${albumId}/rough-demos`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | RoughDemoCollection
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("demos" in payload) || !("reviews" in payload)) {
        throw new Error(getPayloadError(payload, "Save failed."));
      }

      applyCollection(payload);
      setStatus(editingId ? "Demo updated." : "Demo added.");
      setEditingId(null);
      setForm(emptyForm());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
      window.setTimeout(() => setStatus(""), 1800);
    }
  }

  async function deleteDemo(demoId: string) {
    setDeletingId(demoId);
    try {
      const response = await fetch(`/api/albums/${albumId}/rough-demos/${demoId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | RoughDemoCollection
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("demos" in payload) || !("reviews" in payload)) {
        throw new Error(getPayloadError(payload, "Delete failed."));
      }
      applyCollection(payload);
      if (editingId === demoId) {
        setEditingId(null);
        setForm(emptyForm());
      }
      setStatus("Demo removed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeletingId(null);
      window.setTimeout(() => setStatus(""), 1800);
    }
  }

  async function handleFileChange(file: File | null) {
    if (!file) {
      setForm((current) => ({ ...current, localFile: null }));
      return;
    }

    const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
    setForm((current) => ({
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
      setForm((current) => {
        if (!current.localFile || current.localFile.name !== file.name) return current;
        return {
          ...current,
          localFile: {
            ...current.localFile,
            duration_seconds: duration,
          },
        };
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
  const topHeadline = reviews[0]?.headline ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-line bg-raised p-4">
          <div className="text-xs text-ink-3">Rough demo intake</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-ink">
            Capture the voice memo before the good idea disappears
          </div>
          <div className="mt-2 max-w-[72ch] text-sm text-ink-2">
            Save rough demo metadata, notes, and next moves. Local audio files are read only for
            metadata here and are not uploaded or stored on the server.
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-raised p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-ink-3">
                {editingId ? "Edit rough demo" : "Add rough demo"}
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                Turn a memo, riff, or rehearsal pass into a structured next step
              </div>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
                className="rounded-full border border-line bg-raised px-3 py-2 text-xs font-semibold text-ink hover:bg-hover"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              <span className="text-xs text-ink-3">Demo title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Hallway chorus memo"
                aria-label="Demo title"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink-2">
              <span className="text-xs text-ink-3">Source kind</span>
              <select
                value={form.sourceKind}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sourceKind: event.target.value }))
                }
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Source kind"
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getRoughDemoSourceLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink-2">
              <span className="text-xs text-ink-3">Song target</span>
              <select
                value={form.songTrackNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, songTrackNumber: event.target.value }))
                }
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Song target"
              >
                <option value="">Album-wide</option>
                {songOptions.map((song) => (
                  <option key={`${song.trackNumber}-${song.title}`} value={String(song.trackNumber)}>
                    {song.trackNumber}. {song.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink-2">
              <span className="text-xs text-ink-3">External URL</span>
              <input
                value={form.externalUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, externalUrl: event.target.value }))
                }
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="https://..."
                aria-label="External URL"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink-2 md:col-span-2">
              <span className="text-xs text-ink-3">Local rough demo file</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-black"
                aria-label="Local rough demo file"
              />
            </label>

            {form.localFile ? (
              <div className="rounded-2xl border border-line bg-sunken px-4 py-3 text-xs text-ink-2 md:col-span-2">
                {form.localFile.name}
                {form.localFile.duration_seconds ? ` · ${form.localFile.duration_seconds}s` : ""}
                {formatBytes(form.localFile.size_bytes) ? ` · ${formatBytes(form.localFile.size_bytes)}` : ""}
                {form.localFile.mime_type ? ` · ${form.localFile.mime_type}` : ""}
              </div>
            ) : null}

            <label className="flex flex-col gap-1 text-sm text-ink-2 md:col-span-2">
              <span className="text-xs text-ink-3">What this demo captures</span>
              <textarea
                value={form.captureNotes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, captureNotes: event.target.value }))
                }
                rows={4}
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="The verse melody is weak, but the chorus rhythm and last line feel worth keeping."
                aria-label="What this demo captures"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink-2">
              <span className="text-xs text-ink-3">Sonic traits</span>
              <textarea
                value={form.sonicTraits}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sonicTraits: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="muted guitar, handclap pulse, breathy hook"
                aria-label="Sonic traits"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink-2">
              <span className="text-xs text-ink-3">Lyrical fragments</span>
              <textarea
                value={form.lyricalFragments}
                onChange={(event) =>
                  setForm((current) => ({ ...current, lyricalFragments: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="missed the exit, static glow, room 309"
                aria-label="Lyrical fragments"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink-2 md:col-span-2">
              <span className="text-xs text-ink-3">Next moves</span>
              <textarea
                value={form.nextActions}
                onChange={(event) =>
                  setForm((current) => ({ ...current, nextActions: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-line-strong bg-sunken px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="rewrite verse 1, test a slower tempo, move this hook to Track 3"
                aria-label="Next moves"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveDemo}
              disabled={isSaving}
              className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : editingId ? "Update demo" : "Add demo"}
            </button>
            {status ? <div className="text-xs text-ink-3">{status}</div> : null}
          </div>
        </div>

        <div className="space-y-3">
          {demos.length ? (
            demos.map((demo) => {
              const review = reviewsById[demo.id];

              return (
                <div
                  key={demo.id}
                  className="rounded-2xl border border-line bg-raised p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{demo.title}</div>
                      <div className="mt-1 text-xs text-ink-3">
                        {getRoughDemoSourceLabel(demo.source_kind)}
                        {demo.song_track_number ? ` · Track ${demo.song_track_number}` : " · Album-wide"}
                        {demo.local_file?.name ? ` · ${demo.local_file.name}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(demo.id);
                          setForm(toForm(demo));
                        }}
                        className="rounded-full border border-line bg-raised px-3 py-2 text-[10px] font-semibold text-ink hover:bg-hover"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteDemo(demo.id)}
                        disabled={deletingId === demo.id}
                        className="rounded-full border border-[rgba(255,120,120,0.24)] bg-[rgba(255,120,120,0.10)] px-3 py-2 text-[10px] font-semibold text-[rgba(255,210,210,0.95)] hover:bg-[rgba(255,120,120,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === demo.id ? "Removing..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  {demo.capture_notes ? (
                    <div className="mt-3 text-sm leading-relaxed text-ink-2">
                      {demo.capture_notes}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {demo.sonic_traits.slice(0, 4).map((item) => (
                      <span
                        key={`${demo.id}-trait-${item}`}
                        className="rounded-full border border-line bg-sunken px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  {review ? (
                    <div className="mt-4 rounded-2xl border border-line bg-sunken p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                            Structured review
                          </div>
                          <div className="mt-1 text-sm font-semibold text-ink">
                            {review.headline}
                          </div>
                        </div>
                        <div className="rounded-full border border-line-strong bg-raised px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                          {review.signalScore}/100 · {review.readinessLabel}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                            Suggested placement
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-ink-2">
                            {review.suggestedPlacement}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                            Track fit
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-ink-2">
                            {review.recommendedTrack
                              ? `Track ${review.recommendedTrack.trackNumber}: ${review.recommendedTrack.title}`
                              : "Still album-wide until a track becomes obvious."}
                          </div>
                          {review.recommendedTrack ? (
                            <div className="mt-1 text-[11px] text-ink-3">
                              {review.recommendedTrack.reason}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {review.focusTags.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {review.focusTags.map((item) => (
                            <span
                              key={`${demo.id}-focus-${item}`}
                              className="rounded-full border border-line bg-raised px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {review.nextMoves.length ? (
                        <div className="mt-3 text-xs text-ink-2">
                          Next: {review.nextMoves.join(" · ")}
                        </div>
                      ) : null}

                      {review.concerns.length ? (
                        <div className="mt-2 text-[11px] text-ink-3">
                          Watch: {review.concerns.join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {demo.next_actions.length ? (
                    <div className="mt-3 text-xs text-ink-3">
                      Saved next moves: {demo.next_actions.join(" · ")}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-line bg-raised px-4 py-10 text-center text-sm text-ink-2">
              No rough demos yet. Save a voice memo, riff sketch, or rehearsal pass before it gets lost.
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-line bg-raised p-4">
          <div className="text-xs text-ink-3">Coverage</div>
          <div className="mt-1 text-lg font-semibold text-ink">{demos.length} demos</div>
          <div className="mt-2 text-sm text-ink-2">
            {targetedCount} song-targeted · {importedCount} local imports
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-raised p-4">
          <div className="text-xs text-ink-3">Review queue</div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {readyCount} handoff-ready
          </div>
          <div className="mt-2 text-sm text-ink-2">
            {unassignedCount} still need a track decision
          </div>
          <div className="mt-3 text-xs text-ink-3">
            {topHeadline ?? "Structured review will appear as soon as you save a demo."}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-raised p-4">
          <div className="text-xs text-ink-3">Good input checklist</div>
          <div className="mt-2 space-y-2 text-sm text-ink-2">
            <div>Capture what the demo proves, not just what it is.</div>
            <div>Tag the track if you already know where the idea belongs.</div>
            <div>Write the next move while the idea is still fresh.</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
