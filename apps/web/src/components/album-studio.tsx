"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Download, Loader2, Play, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { usePlayerControls, PREVIEW_FAILED_MESSAGE } from "@/components/player/player-provider";
import { RelativeTime } from "@/components/relative-time";
import { SectionComments } from "@/components/section-comments";
import { SongDevelopmentAi } from "@/components/song-development-ai";
import { ALBUM_THEMES_INPUT_ID, AlbumDetails } from "@/components/studio/album-details";
import { SongStoryEditor, STORY_FOCUS_TARGETS } from "@/components/studio/song-story-editor";
import {
  KEY_OPTIONS,
  SECTION_TYPES,
  TEMPO_MAX,
  TEMPO_MIN,
  albumProblem,
  buildNewSection,
  buildNewSong,
  chordsOf,
  clampIndex,
  clampTempo,
  isWritten,
  normalizeOrders,
  normalizeTrackNumbers,
  parseChordProgression,
  parseInitialAlbum,
  readApiError,
  sectionLabels,
  sectionTypeLabel,
  stringifyChordProgression,
  type StudioAlbum,
  type StudioSection,
  type StudioSong,
} from "@/components/studio/studio-model";
import { Button, EmptyState, Field, IconButton, Section, buttonClass, inputClass, selectClass, textareaClass } from "@/components/ui";
import { cn } from "@/lib/utils";

type SelectionInput = {
  song?: string;
  section?: string;
  sid?: string;
  q?: string;
  /**
   * "story" or "themes": focus the selected song's story editor (themes lands on its Themes field).
   * "album": open the album details and focus the album's central themes.
   */
  focus?: string;
};

type AlbumStudioProps = {
  albumId: string;
  initialAlbum: unknown;
  initialSelection?: SelectionInput;
};

type SaveMode = "auto" | "manual" | "version";

type UndoEntry =
  | { kind: "track"; song: StudioSong; index: number; label: string; key: number }
  | { kind: "section"; songId: string; section: StudioSection; index: number; label: string; key: number };

type PreviewNote = { tone: "neutral" | "ok" | "danger"; text: string; retry?: () => void };

const AUTOSAVE_DELAY_MS = 2000;
const UNDO_WINDOW_MS = 10_000;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function resolveSelection(album: StudioAlbum, selection: SelectionInput | undefined) {
  const songs = album.songs;
  let song = 0;
  const track = selection?.song && /^\d+$/.test(selection.song) ? Number(selection.song) : null;
  if (track != null) {
    const found = songs.findIndex((s) => s.track_number === track);
    if (found >= 0) song = found;
  }
  const sections = songs[song]?.sections ?? [];
  let section = 0;
  const sid = selection?.sid?.trim();
  if (sid) {
    const found = sections.findIndex((s) => s.id === sid);
    if (found >= 0) section = found;
  } else if (selection?.section && /^\d+$/.test(selection.section)) {
    const order = Number(selection.section);
    const found = sections.findIndex((s) => s.order === order);
    if (found >= 0) section = found;
  }
  return { song, section };
}

function focusTargetFor(focus: string | undefined | null) {
  if (focus === "themes") return STORY_FOCUS_TARGETS.themes;
  if (focus === "story") return STORY_FOCUS_TARGETS.story;
  if (focus === "album") return ALBUM_THEMES_INPUT_ID;
  return null;
}

/** Chords are typed as free text; the parsed list is stored, the typed text is kept while editing. */
function ChordInput({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: unknown;
  onChange: (chords: string[]) => void;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState(() => stringifyChordProgression(value));
  return (
    <input
      id={id}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseChordProgression(e.target.value));
      }}
      onBlur={() => setDraft(stringifyChordProgression(parseChordProgression(draft)))}
      aria-describedby={describedBy}
      autoComplete="off"
      spellCheck={false}
      className={inputClass}
      placeholder="C Am F G"
    />
  );
}

function useAlbumStudioRender({ albumId, initialAlbum, initialSelection }: AlbumStudioProps) {
  const router = useRouter();
  const player = usePlayerControls();
  const initialParsed = useMemo(() => parseInitialAlbum(initialAlbum), [initialAlbum]);

  const [album, setAlbum] = useState<StudioAlbum>(initialParsed.album);
  const [selection, setSelection] = useState(() => resolveSelection(initialParsed.album, initialSelection));
  const [versionMessage, setVersionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    typeof initialParsed.album.updated_at === "string" ? initialParsed.album.updated_at : null,
  );
  const [manualNote, setManualNote] = useState<string | null>(null);
  const [stableIdsPersisted, setStableIdsPersisted] = useState(!initialParsed.idsWereMissing);
  const [previewing, setPreviewing] = useState(false);
  const [previewNote, setPreviewNote] = useState<PreviewNote | null>(null);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(() => focusTargetFor(initialSelection?.focus));
  const [detailsOpen, setDetailsOpen] = useState(() => initialSelection?.focus === "album");

  const albumRef = useRef(album);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef<SaveMode | null>(null);
  const headlineRef = useRef(`${album.title}|${album.artist ?? ""}|${album.songs.length}`);
  const saveRef = useRef<(mode: SaveMode) => Promise<void>>(async () => {});
  const moreRef = useRef<HTMLDetailsElement | null>(null);

  // Deep links (?song=N&section=M&sid=…&focus=story|themes) select a track and section. They are
  // applied on first render and again whenever the link itself changes, never on ordinary edits.
  const selectionKey = [initialSelection?.song, initialSelection?.section, initialSelection?.sid, initialSelection?.focus].join("|");
  const [appliedSelectionKey, setAppliedSelectionKey] = useState(selectionKey);
  if (appliedSelectionKey !== selectionKey) {
    setAppliedSelectionKey(selectionKey);
    if (initialSelection?.song) setSelection(resolveSelection(album, initialSelection));
    const target = focusTargetFor(initialSelection?.focus);
    if (target) setPendingFocus(target);
    if (initialSelection?.focus === "album") setDetailsOpen(true);
  }

  const songs = album.songs;
  const songIndex = clampIndex(selection.song, songs.length);
  const activeSong: StudioSong | undefined = songs[songIndex];
  const sections = useMemo(() => activeSong?.sections ?? [], [activeSong?.sections]);
  const sectionIndex = clampIndex(selection.section, sections.length);
  const activeSection: StudioSection | undefined = sections[sectionIndex];
  const labels = useMemo(() => sectionLabels(sections), [sections]);
  const activeLabel = labels[sectionIndex] ?? "Section";

  useEffect(() => {
    albumRef.current = album;
  }, [album]);

  // Moves focus once the target exists: a deep-linked story field, a restored row, Undo.
  useEffect(() => {
    if (!pendingFocus) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(pendingFocus);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "center" });
      }
      setPendingFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingFocus, songIndex]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  // ------------------------------------------------------------------ saving

  async function save(mode: SaveMode) {
    if (savingRef.current) {
      // Never two saves at once: an explicit save waits for the one in flight, then runs.
      if (mode !== "auto") queuedRef.current = mode;
      return;
    }
    const snapshot = albumRef.current;
    const problem = albumProblem(snapshot);
    if (problem) {
      setSaveError(problem);
      return;
    }
    const revision = revisionRef.current;
    const message = mode === "version" ? versionMessage.trim() || undefined : undefined;

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    if (mode !== "auto") setManualNote(null);
    try {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album: snapshot, versionMessage: message }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Something went wrong on our side."));
      }
      setLastSavedAt(new Date().toISOString());
      setStableIdsPersisted(true);
      if (revisionRef.current === revision) setDirty(false);
      if (mode === "version") setVersionMessage("");
      if (mode !== "auto") setManualNote(mode === "version" ? "Saved as a new version." : "Saved.");
      const headline = `${snapshot.title}|${snapshot.artist ?? ""}|${snapshot.songs.length}`;
      if (headline !== headlineRef.current) {
        headlineRef.current = headline;
        router.refresh();
      }
    } catch (err) {
      const offline = err instanceof TypeError;
      setSaveError(
        offline
          ? "The server can't be reached. Your edits are still here."
          : err instanceof Error && err.message
            ? err.message
            : "Something went wrong on our side.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
      const queued = queuedRef.current;
      queuedRef.current = null;
      if (queued) void saveRef.current(queued);
    }
  }

  useEffect(() => {
    saveRef.current = save;
  });

  // Autosave ~2s after the last edit, only when there is something to save and nothing in flight.
  useEffect(() => {
    if (!dirty || saving || saveError) return;
    const timer = window.setTimeout(() => void saveRef.current("auto"), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [album, dirty, saving, saveError]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current("manual");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ------------------------------------------------------------------ editing

  function edit(updater: (prev: StudioAlbum) => StudioAlbum) {
    setAlbum(updater);
    revisionRef.current += 1;
    setDirty(true);
    setSaveError(null);
    setManualNote(null);
  }

  function selectSong(index: number) {
    setSelection({ song: clampIndex(index, songs.length), section: 0 });
  }

  function selectSection(index: number) {
    setSelection({ song: songIndex, section: clampIndex(index, sections.length) });
  }

  function updateSongField<K extends keyof StudioSong>(key: K, value: StudioSong[K]) {
    edit((prev) => ({
      ...prev,
      songs: prev.songs.map((song, i) => (i === songIndex ? { ...song, [key]: value } : song)),
    }));
  }

  function updateSections(songId: string | undefined, fn: (sections: StudioSection[]) => StudioSection[]) {
    edit((prev) => ({
      ...prev,
      songs: prev.songs.map((song, i) =>
        (songId ? song.id === songId : i === songIndex) ? { ...song, sections: normalizeOrders(fn(song.sections ?? [])) } : song,
      ),
    }));
  }

  function updateSectionField<K extends keyof StudioSection>(key: K, value: StudioSection[K]) {
    updateSections(activeSong?.id, (list) => list.map((s, i) => (i === sectionIndex ? { ...s, [key]: value } : s)));
  }

  function addTrack() {
    const index = songs.length;
    edit((prev) => ({ ...prev, songs: [...prev.songs, buildNewSong(prev.songs.length + 1)] }));
    setSelection({ song: index, section: 0 });
  }

  function deleteTrack(index: number) {
    const song = songs[index];
    if (!song) return;
    if (moreRef.current) moreRef.current.open = false;
    edit((prev) => ({ ...prev, songs: normalizeTrackNumbers(prev.songs.filter((_, i) => i !== index)) }));
    setUndo({ kind: "track", song, index, label: song.title || `Track ${song.track_number}`, key: Date.now() });
    setSelection({ song: Math.max(0, index - 1), section: 0 });
    setPendingFocus("studio-undo");
  }

  function addSection() {
    const index = sections.length;
    updateSections(activeSong?.id, (list) => [...list, buildNewSection(list.length)]);
    setSelection({ song: songIndex, section: index });
  }

  function deleteSection(index: number) {
    const section = sections[index];
    if (!activeSong?.id || !section) return;
    updateSections(activeSong.id, (list) => list.filter((_, i) => i !== index));
    setUndo({ kind: "section", songId: activeSong.id, section, index, label: labels[index] ?? "Section", key: Date.now() });
    setSelection({ song: songIndex, section: Math.max(0, index - 1) });
    setPendingFocus("studio-undo");
  }

  function restoreDeleted() {
    if (!undo) return;
    if (undo.kind === "track") {
      const { song, index } = undo;
      edit((prev) => {
        const next = [...prev.songs];
        next.splice(Math.min(index, next.length), 0, song);
        return { ...prev, songs: normalizeTrackNumbers(next) };
      });
      setSelection({ song: index, section: 0 });
      setPendingFocus(`track-row-${song.id}`);
    } else {
      const { songId, section, index } = undo;
      const owner = songs.findIndex((s) => s.id === songId);
      updateSections(songId, (list) => {
        const next = [...list];
        next.splice(Math.min(index, next.length), 0, section);
        return next;
      });
      if (owner >= 0) setSelection({ song: owner, section: index });
      setPendingFocus(`section-row-${section.id}`);
    }
    setUndo(null);
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    updateSections(activeSong?.id, (list) => {
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelection({ song: songIndex, section: target });
  }

  // ------------------------------------------------------------------ previews

  const songTitle = activeSong ? activeSong.title || `Track ${activeSong.track_number}` : "";

  async function previewFromChords(chords: string[], subtitle: string) {
    const retry = () => void previewFromChords(chords, subtitle);
    setPreviewing(true);
    setPreviewNote({ tone: "neutral", text: "Rendering preview…" });
    // Best effort: unlock audio on this click so playback can start right away.
    void player.arm().catch(() => null);
    try {
      const response = await fetch("/api/midi/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chords, tempo: clampTempo(activeSong?.tempo), barsPerChord: 1, title: songTitle }),
      });
      if (!response.ok) {
        const text = response.status === 429 ? await readApiError(response, PREVIEW_FAILED_MESSAGE) : PREVIEW_FAILED_MESSAGE;
        setPreviewNote({ tone: "danger", text, retry });
        return;
      }
      const midi = await response.arrayBuffer();
      await player.loadMidi({ midi, title: songTitle, subtitle });
      setPreviewNote(null);
      try {
        await player.play();
      } catch {
        setPreviewNote({ tone: "neutral", text: "Preview loaded. Press Play in the player to start it." });
      }
    } catch {
      setPreviewNote({ tone: "danger", text: PREVIEW_FAILED_MESSAGE, retry });
    } finally {
      setPreviewing(false);
    }
  }

  async function downloadMp3(chords: string[], subtitle: string) {
    const retry = () => void downloadMp3(chords, subtitle);
    const failed =
      "Couldn't render the MP3. Audio rendering may not be set up on this server yet; Preview still plays in your browser.";
    setPreviewing(true);
    setPreviewNote({ tone: "neutral", text: "Rendering MP3…" });
    try {
      const response = await fetch("/api/audio/preview/mp3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chords, tempo: clampTempo(activeSong?.tempo), barsPerChord: 1, title: songTitle }),
      });
      if (!response.ok) {
        const text = response.status === 429 ? await readApiError(response, failed) : failed;
        setPreviewNote({ tone: "danger", text, retry });
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const safe = `${songTitle} ${subtitle}`.trim() || "preview";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safe.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_")}.mp3`;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setPreviewNote({ tone: "ok", text: "MP3 downloaded." });
    } catch {
      setPreviewNote({ tone: "danger", text: failed, retry });
    } finally {
      setPreviewing(false);
    }
  }

  function previewSection() {
    const chords = chordsOf(activeSection);
    if (!chords.length) {
      setPreviewNote({ tone: "neutral", text: "Add a chord progression to preview this section." });
      return;
    }
    void previewFromChords(chords, activeLabel);
  }

  function previewSong() {
    const chords = sections.flatMap((section) => chordsOf(section));
    if (!chords.length) {
      setPreviewNote({ tone: "neutral", text: "Add chord progressions to the sections to preview this track." });
      return;
    }
    void previewFromChords(chords, "Whole track");
  }

  function downloadSectionMp3() {
    const chords = chordsOf(activeSection);
    if (!chords.length) {
      setPreviewNote({ tone: "neutral", text: "Add a chord progression to render an MP3." });
      return;
    }
    void downloadMp3(chords, activeLabel);
  }

  // ------------------------------------------------------------------ render

  const writtenCount = sections.filter((s) => isWritten(s.lyrics)).length;
  const tempo = activeSong?.tempo ?? null;
  const tempoOutOfRange = tempo != null && (tempo < TEMPO_MIN || tempo > TEMPO_MAX);
  const keyValue = activeSong?.key ?? "";
  const sectionType = activeSection?.section_type ?? "verse";
  const sectionTypeKnown = SECTION_TYPES.some((t) => t.value === sectionType);

  const saveBar = (
    <div className="sticky top-header z-20 -mx-4 border-b border-line bg-ground px-4 py-2 md:-mx-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p role="status" className={cn("flex min-h-11 items-center gap-2 text-sm", saveError ? "text-danger" : "text-ink-2")}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : saveError ? (
              <span>Couldn&apos;t save — {saveError}</span>
            ) : dirty ? (
              "Unsaved changes"
            ) : lastSavedAt ? (
              <span>
                Saved · <RelativeTime date={lastSavedAt} />
              </span>
            ) : (
              "No changes yet"
            )}
          </p>
          {saveError && !saving ? (
            <Button tone="secondary" onClick={() => void save("manual")}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p role="status" className="text-sm text-ok">
            {manualNote ?? ""}
          </p>
          <span className="hidden text-xs text-ink-3 lg:inline">Autosaves as you write · Ctrl or ⌘ + S</span>
          <Button tone="primary" onClick={() => void save("manual")} aria-keyshortcuts="Control+S Meta+S">
            <Save className="h-4 w-4" aria-hidden="true" />
            Save
          </Button>
        </div>
      </div>
      <div role="status">
        {undo ? (
          <p className="flex flex-wrap items-center gap-x-3 pb-1 text-sm text-ink">
            <span>Deleted “{undo.label}”.</span>
            <Button id="studio-undo" key={undo.key} tone="secondary" onClick={restoreDeleted}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Undo
            </Button>
          </p>
        ) : null}
      </div>
    </div>
  );

  const trackList = (
    <section aria-labelledby="studio-tracks-title" className="min-w-0 lg:row-span-2 2xl:row-span-1">
      <div className="lg:sticky lg:top-40">
        <div className="flex items-center justify-between gap-2">
          <h2 id="studio-tracks-title" className="text-lg font-semibold text-ink">
            Tracks
          </h2>
          <Button tone="ghost" onClick={addTrack}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add track
          </Button>
        </div>
        {songs.length ? (
          <ol className="mt-2 max-h-80 overflow-auto border-t border-line lg:max-h-[70vh]">
            {songs.map((song, index) => {
              const isActive = index === songIndex;
              const total = song.sections?.length ?? 0;
              const written = (song.sections ?? []).filter((s) => isWritten(s.lyrics)).length;
              return (
                <li key={song.id ?? `${song.track_number}-${song.title}`} className="border-b border-line">
                  <button
                    id={`track-row-${song.id}`}
                    type="button"
                    onClick={() => selectSong(index)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-2 py-2 text-left transition-colors",
                      isActive ? "bg-selected" : "hover:bg-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "type-figure w-9 shrink-0 text-2xl font-semibold",
                        isActive ? "text-accent" : "text-ink-3",
                      )}
                    >
                      {pad2(song.track_number)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{song.title || "Untitled"}</span>
                      <span className="type-figure block truncate text-xs text-ink-2">
                        {total ? `${written}/${total} sections written` : "No sections yet"}
                        {song.tempo ? ` · ${song.tempo} bpm` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </section>
  );

  const songEditor = activeSong ? (
    <section aria-labelledby="studio-song-title" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="studio-song-title" className="text-2xl font-semibold break-words text-ink">
            <span className="type-figure mr-2 text-ink-3">{pad2(activeSong.track_number)}</span>
            {activeSong.title || "Untitled"}
          </h2>
          <p className="type-catalog mt-2 flex flex-wrap gap-x-2 text-xs text-ink-2">
            <span className="type-figure">
              {sections.length} {sections.length === 1 ? "section" : "sections"} · {writtenCount} written
            </span>
            {activeSong.key ? <span>· {activeSong.key}</span> : null}
            {activeSong.tempo ? <span className="type-figure">· {activeSong.tempo} bpm</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button tone="secondary" onClick={previewSong} disabled={previewing}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Preview song
          </Button>
          <details
            ref={moreRef}
            className="relative"
            onKeyDown={(e) => {
              if (e.key === "Escape" && moreRef.current?.open) {
                moreRef.current.open = false;
                moreRef.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary className={cn(buttonClass("secondary"), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
              More
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded border border-line-strong bg-raised p-3">
              <Button tone="danger" className="w-full" onClick={() => deleteTrack(songIndex)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete track
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                Removes this track and its sections. You can undo for 10 seconds.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 @lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field
          label="Track title"
          htmlFor="song-title"
          className="col-span-2 @lg:col-span-1"
          error={activeSong.title.trim() ? undefined : "A track needs a title before it can be saved."}
        >
          <input
            id="song-title"
            value={activeSong.title ?? ""}
            onChange={(e) => updateSongField("title", e.target.value)}
            maxLength={200}
            aria-invalid={activeSong.title.trim() ? undefined : true}
            aria-describedby={activeSong.title.trim() ? undefined : "song-title-error"}
            className={inputClass}
          />
        </Field>
        <Field label="Key" htmlFor="song-key" className="min-w-0">
          <select
            id="song-key"
            value={keyValue}
            onChange={(e) => updateSongField("key", e.target.value || null)}
            className={selectClass}
          >
            <option value="">Not set</option>
            {keyValue && !KEY_OPTIONS.includes(keyValue) ? <option value={keyValue}>{keyValue}</option> : null}
            <optgroup label="Major">
              {KEY_OPTIONS.filter((k) => k.endsWith("major")).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </optgroup>
            <optgroup label="Minor">
              {KEY_OPTIONS.filter((k) => k.endsWith("minor")).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field
          label="Tempo (bpm)"
          htmlFor="song-tempo"
          className="min-w-0"
          hint={`${TEMPO_MIN}–${TEMPO_MAX}`}
          error={tempoOutOfRange ? `Use ${TEMPO_MIN} to ${TEMPO_MAX} bpm.` : undefined}
        >
          <input
            id="song-tempo"
            type="number"
            inputMode="numeric"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            step={1}
            value={tempo ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) return updateSongField("tempo", null);
              const next = Math.round(Number(raw));
              if (Number.isFinite(next)) updateSongField("tempo", next);
            }}
            onBlur={() => {
              if (tempoOutOfRange) updateSongField("tempo", clampTempo(tempo));
            }}
            aria-invalid={tempoOutOfRange || undefined}
            aria-describedby={tempoOutOfRange ? "song-tempo-error" : "song-tempo-hint"}
            className={cn(inputClass, "type-figure")}
            placeholder="120"
          />
        </Field>
      </div>

      <SongStoryEditor
        key={activeSong.id}
        song={activeSong}
        albumThemes={album.central_themes ?? []}
        albumMotifs={album.recurring_motifs ?? []}
        onChange={updateSongField}
      />

      <div className="border-t border-line pt-5">
        <SongDevelopmentAi
          key={activeSong.id}
          albumId={albumId}
          songTitle={songTitle}
          trackNumber={activeSong.track_number}
        />
      </div>
    </section>
  ) : null;

  const sectionEditor = activeSong ? (
    <Section
      id="studio-sections"
      title="Sections"
      description="The song’s structure, in order. Each section holds its own lyrics, chords and comments."
      actions={
        <Button tone="secondary" onClick={addSection}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add section
        </Button>
      }
    >
      {sections.length ? (
        <div className="grid grid-cols-1 gap-6 @xl:grid-cols-[12rem_minmax(0,1fr)]">
          <ol aria-label={`Sections of ${songTitle}`} className="self-start border-t border-line">
            {sections.map((section, index) => {
              const isActive = index === sectionIndex;
              const chordCount = chordsOf(section).length;
              return (
                <li key={section.id ?? `${section.section_type}-${section.order}`} className="border-b border-line">
                  <button
                    id={`section-row-${section.id}`}
                    type="button"
                    onClick={() => selectSection(index)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors",
                      isActive ? "bg-selected text-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cn("block truncate text-sm", isActive && "font-semibold")}>{labels[index]}</span>
                      <span className="type-figure block truncate text-xs text-ink-3">
                        {isWritten(section.lyrics) ? "Lyrics written" : "No lyrics yet"} ·{" "}
                        {chordCount ? `${chordCount} ${chordCount === 1 ? "chord" : "chords"}` : "no chords"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {activeSection ? (
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink">{activeLabel}</h3>
                  <p className="type-figure text-xs text-ink-3">
                    Section {sectionIndex + 1} of {sections.length}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button tone="secondary" onClick={previewSection} disabled={previewing}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Preview
                  </Button>
                  <Button tone="ghost" onClick={downloadSectionMp3} disabled={previewing} aria-describedby="studio-mp3-note">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    MP3
                  </Button>
                  <IconButton
                    label="Move section up"
                    onClick={() => moveSection(sectionIndex, -1)}
                    disabled={sectionIndex === 0}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label="Move section down"
                    onClick={() => moveSection(sectionIndex, 1)}
                    disabled={sectionIndex >= sections.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <Button tone="danger" onClick={() => deleteSection(sectionIndex)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete section
                  </Button>
                </div>
              </div>
              <p id="studio-mp3-note" className="text-xs leading-relaxed text-ink-3">
                Preview plays in your browser. MP3 downloads need audio rendering set up on the server, so they may
                not work on every install.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <p
                  role="status"
                  className={cn(
                    "text-sm",
                    previewNote?.tone === "danger" ? "text-danger" : previewNote?.tone === "ok" ? "text-ok" : "text-ink-2",
                  )}
                >
                  {previewNote?.text ?? ""}
                </p>
                {previewNote?.retry && !previewing ? (
                  <Button tone="secondary" onClick={previewNote.retry}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Retry
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Field label="Section type" htmlFor="section-type">
                  <select
                    id="section-type"
                    value={sectionType}
                    onChange={(e) => updateSectionField("section_type", e.target.value)}
                    className={selectClass}
                  >
                    {!sectionTypeKnown ? <option value={sectionType}>{sectionTypeLabel(sectionType)}</option> : null}
                    {SECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Chord progression"
                  htmlFor="section-chords"
                  hint="Separate chords with spaces or commas. Loops of 4 to 8 chords export cleanly."
                >
                  <ChordInput
                    key={activeSection.id}
                    id="section-chords"
                    value={activeSection.chord_progression}
                    onChange={(chords) => updateSectionField("chord_progression", chords)}
                    describedBy="section-chords-hint"
                  />
                </Field>
              </div>

              <Field label="Lyrics draft" htmlFor="section-lyrics">
                <textarea
                  id="section-lyrics"
                  value={activeSection.lyrics ?? ""}
                  onChange={(e) => updateSectionField("lyrics", e.target.value)}
                  rows={12}
                  className={cn(textareaClass, "min-h-60 resize-y")}
                  placeholder="Write lyrics for this section…"
                />
              </Field>

              {stableIdsPersisted && activeSection.id ? (
                <SectionComments
                  albumId={albumId}
                  section={{
                    id: activeSection.id,
                    songTrackNumber: activeSong.track_number,
                    sectionType: activeSection.section_type,
                    sectionOrder: activeSection.order,
                    label: activeLabel,
                  }}
                />
              ) : (
                <section aria-labelledby="comments-pending-title" className="border-t border-line pt-5">
                  <h3 id="comments-pending-title" className="text-base font-semibold text-ink">
                    Comments
                  </h3>
                  <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-ink-2">
                    This album came in without stable section references. Save once to turn on comments and
                    shareable section links.
                  </p>
                  <Button tone="secondary" className="mt-3" onClick={() => void save("manual")} disabled={saving}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save to enable comments
                  </Button>
                </section>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="This track has no sections yet"
          action={
            <Button tone="secondary" onClick={addSection}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add section
            </Button>
          }
        >
          Start with a verse or a chorus. Each section gets its own lyrics, chords and comments.
        </EmptyState>
      )}
    </Section>
  ) : null;

  const versionPanel = (
    <Section id="studio-version" title="Save a version" description="A named snapshot of the album as it is now, kept in its version history.">
      <div className="flex flex-col gap-3">
        <Field label="Version note" htmlFor="version-message" hint="For example: tightened chorus, new bridge chords.">
          <input
            id="version-message"
            value={versionMessage}
            onChange={(e) => setVersionMessage(e.target.value)}
            maxLength={200}
            aria-describedby="version-message-hint"
            className={inputClass}
          />
        </Field>
        <div>
          <Button tone="secondary" onClick={() => void save("version")} disabled={saving || !versionMessage.trim()}>
            Save version
          </Button>
        </div>
      </div>
    </Section>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {saveBar}
      <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        {trackList}

        <div className="@container flex min-w-0 flex-col gap-10">
          {songs.length ? (
            <>
              {songEditor}
              {sectionEditor}
            </>
          ) : (
            <EmptyState
              title="Start the record with its first track"
              action={
                <Button tone="secondary" onClick={addTrack}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add track
                </Button>
              }
            >
              Each track gets a story, a key and tempo, and sections with lyrics and chords.
            </EmptyState>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-10 lg:col-start-2 2xl:col-start-3 2xl:row-start-1">
          <AlbumDetails
            album={album}
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            onChange={(patch) => edit((prev) => ({ ...prev, ...patch }))}
          />
          {versionPanel}
        </div>
      </div>
    </div>
  );
}

export function AlbumStudio(props: AlbumStudioProps) {
  return useAlbumStudioRender(props);
}
