"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Loader2, Play, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { usePlayerControls, PREVIEW_FAILED_MESSAGE } from "@/components/player/player-provider";
import { RelativeTime } from "@/components/relative-time";
import { SectionComments } from "@/components/section-comments";
import { SongDevelopmentAi } from "@/components/song-development-ai";
import { ALBUM_MOTIFS_INPUT_ID, ALBUM_THEMES_INPUT_ID, AlbumDetails } from "@/components/studio/album-details";
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
import { MAX_THEME_COLUMNS, STUDIO_GRID_COLUMNS, TrackList, pad2 } from "@/components/studio/track-list";
import { Button, EmptyState, Field, IconButton, Section, inputClass, selectClass, textareaClass } from "@/components/ui";
import { lyricProgress } from "@/lib/lyrics";
import { cn } from "@/lib/utils";

type SelectionInput = {
  song?: string;
  section?: string;
  sid?: string;
  q?: string;
  /**
   * story | themes | song-themes | motifs: open the selected song's story and focus that field.
   * album | album-motifs: open Album details and focus its central themes or recurring motifs.
   */
  focus?: string;
};

type AlbumStudioProps = {
  albumId: string;
  initialAlbum: unknown;
  initialSelection?: SelectionInput;
  /** From `getAgentAvailability()`: false when AI drafting can't run on this server. */
  aiAvailable?: boolean;
};

type SaveMode = "auto" | "manual" | "version";

type UndoEntry =
  | { kind: "track"; song: StudioSong; index: number; label: string; key: number }
  | { kind: "section"; songId: string; section: StudioSection; index: number; label: string; key: number };

type PreviewNote = { tone: "neutral" | "ok" | "danger"; text: string; retry?: () => void };

/** Where focus goes next and how the page may move to show it. */
type PendingFocus = { id: string; scroll: "center" | "nearest" | "none" };

const AUTOSAVE_DELAY_MS = 2000;
const UNDO_WINDOW_MS = 10_000;
/** How long "Saved." stays after an explicit save before the relative time returns. */
const SAVED_FLASH_MS = 4000;

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

/** A deep-link `focus` value → the field to focus and the disclosure that holds it. */
function focusTargetFor(focus: string | undefined | null): { id: string; opens: "story" | "details" } | null {
  switch (focus) {
    case "story":
      return { id: STORY_FOCUS_TARGETS.story, opens: "story" };
    case "themes":
    case "song-themes":
      return { id: STORY_FOCUS_TARGETS.themes, opens: "story" };
    case "motifs":
      return { id: STORY_FOCUS_TARGETS.motifs, opens: "story" };
    case "album":
      return { id: ALBUM_THEMES_INPUT_ID, opens: "details" };
    case "album-motifs":
      return { id: ALBUM_MOTIFS_INPUT_ID, opens: "details" };
    default:
      return null;
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

function Kbd({ children }: { children: string }) {
  return <kbd className="type-figure rounded-sm border border-line px-1 font-sans text-xs text-ink-2">{children}</kbd>;
}

function useAlbumStudioRender({ albumId, initialAlbum, initialSelection, aiAvailable = false }: AlbumStudioProps) {
  const router = useRouter();
  const player = usePlayerControls();
  const initialParsed = useMemo(() => parseInitialAlbum(initialAlbum), [initialAlbum]);
  const initialTarget = focusTargetFor(initialSelection?.focus);

  const [album, setAlbum] = useState<StudioAlbum>(initialParsed.album);
  const [selection, setSelection] = useState(() => resolveSelection(initialParsed.album, initialSelection));
  const [versionMessage, setVersionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    typeof initialParsed.album.updated_at === "string" ? initialParsed.album.updated_at : null,
  );
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [stableIdsPersisted, setStableIdsPersisted] = useState(!initialParsed.idsWereMissing);
  const [previewing, setPreviewing] = useState(false);
  const [previewNote, setPreviewNote] = useState<PreviewNote | null>(null);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(() =>
    initialTarget ? { id: initialTarget.id, scroll: "center" } : null,
  );
  const [storyOpen, setStoryOpen] = useState(() => initialTarget?.opens === "story");
  const [detailsOpen, setDetailsOpen] = useState(() => initialTarget?.opens === "details");
  const [navAnnouncement, setNavAnnouncement] = useState("");
  const [stickyTop, setStickyTop] = useState<number | null>(null);

  const albumRef = useRef(album);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef<SaveMode | null>(null);
  const headlineRef = useRef(`${album.title}|${album.artist ?? ""}|${album.songs.length}`);
  const saveRef = useRef<(mode: SaveMode) => Promise<void>>(async () => {});
  const stepRef = useRef<(what: "track" | "section", dir: -1 | 1) => void>(() => {});
  const saveBarRef = useRef<HTMLDivElement | null>(null);

  // Deep links (?song=N&section=M&sid=…&focus=…) select a track and section. They are applied
  // on first render and again whenever the link itself changes, never on ordinary edits.
  const selectionKey = [initialSelection?.song, initialSelection?.section, initialSelection?.sid, initialSelection?.focus].join("|");
  const [appliedSelectionKey, setAppliedSelectionKey] = useState(selectionKey);
  if (appliedSelectionKey !== selectionKey) {
    setAppliedSelectionKey(selectionKey);
    if (initialSelection?.song) setSelection(resolveSelection(album, initialSelection));
    const target = focusTargetFor(initialSelection?.focus);
    if (target) {
      setPendingFocus({ id: target.id, scroll: "center" });
      if (target.opens === "story") setStoryOpen(true);
      else setDetailsOpen(true);
    }
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

  // The track list sticks just below the save bar, which sticks below the app header. Both
  // offsets are read from the page (the header token and the bar's real height), so the list
  // moves down when the bar grows, e.g. while Undo is offered.
  useEffect(() => {
    const bar = saveBarRef.current;
    if (!bar) return;
    const measure = () => {
      const top = Number.parseFloat(getComputedStyle(bar).top) || 0;
      setStickyTop(Math.round(top + bar.getBoundingClientRect().height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Moves focus once the target exists: a deep-linked field, a restored row, Undo.
  useEffect(() => {
    if (!pendingFocus) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(pendingFocus.id);
      if (el) {
        el.focus({ preventScroll: true });
        if (pendingFocus.scroll !== "none") {
          el.scrollIntoView({
            block: pendingFocus.scroll,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        }
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

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(null), SAVED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

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
    if (mode !== "auto") setSavedFlash(null);
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
      if (mode !== "auto") setSavedFlash(mode === "version" ? "Saved as a new version." : "Saved.");
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

  // Ctrl/⌘+S saves. Alt+↑/↓ moves between tracks, Alt+Shift+↑/↓ between sections. Plain arrows
  // are never taken, nothing fires while an IME is composing, and a focused select keeps
  // Alt+↓ for opening its list.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current("manual");
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (event.target instanceof HTMLSelectElement) return;
      event.preventDefault();
      stepRef.current(event.shiftKey ? "section" : "track", event.key === "ArrowUp" ? -1 : 1);
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
    setSavedFlash(null);
  }

  function selectSong(index: number) {
    setSelection({ song: clampIndex(index, songs.length), section: 0 });
  }

  function selectSection(index: number) {
    setSelection({ song: songIndex, section: clampIndex(index, sections.length) });
  }

  /** Keyboard stepping: keeps focus on the equivalent control of the newly selected item. */
  function step(what: "track" | "section", dir: -1 | 1) {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeId = active?.id ?? "";
    if (what === "track") {
      const next = songIndex + dir;
      const song = songs[next];
      if (!song) return;
      setSelection({ song: next, section: 0 });
      setNavAnnouncement(`Track ${pad2(song.track_number)}: ${song.title || "Untitled"}`);
      if (activeId.startsWith("track-row-")) setPendingFocus({ id: `track-row-${song.id}`, scroll: "none" });
      else if (activeId) setPendingFocus({ id: activeId, scroll: "none" });
    } else {
      const next = sectionIndex + dir;
      const section = sections[next];
      if (!section) return;
      setSelection({ song: songIndex, section: next });
      setNavAnnouncement(`${labels[next] ?? "Section"}, section ${next + 1} of ${sections.length}`);
      if (activeId.startsWith("section-row-")) setPendingFocus({ id: `section-row-${section.id}`, scroll: "none" });
      else if (activeId) setPendingFocus({ id: activeId, scroll: "none" });
    }
  }

  useEffect(() => {
    stepRef.current = step;
  });

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
    setPendingFocus({ id: "song-title", scroll: "nearest" });
  }

  // Deleting never moves the page: the next item is selected in place and focus goes to Undo,
  // which sits in the sticky save bar.
  function deleteTrack(index: number) {
    const song = songs[index];
    if (!song) return;
    edit((prev) => ({ ...prev, songs: normalizeTrackNumbers(prev.songs.filter((_, i) => i !== index)) }));
    setUndo({ kind: "track", song, index, label: song.title || `Track ${song.track_number}`, key: Date.now() });
    setSelection({ song: Math.max(0, Math.min(index, songs.length - 2)), section: 0 });
    setPendingFocus({ id: "studio-undo", scroll: "none" });
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
    setSelection({ song: songIndex, section: Math.max(0, Math.min(index, sections.length - 2)) });
    setPendingFocus({ id: "studio-undo", scroll: "none" });
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
      setPendingFocus({ id: `track-row-${song.id}`, scroll: "nearest" });
    } else {
      const { songId, section, index } = undo;
      const owner = songs.findIndex((s) => s.id === songId);
      updateSections(songId, (list) => {
        const next = [...list];
        next.splice(Math.min(index, next.length), 0, section);
        return next;
      });
      if (owner >= 0) setSelection({ song: owner, section: index });
      setPendingFocus({ id: `section-row-${section.id}`, scroll: "nearest" });
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

  function openAlbumField(id: string) {
    setDetailsOpen(true);
    setPendingFocus({ id, scroll: "center" });
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
    const failed = "Couldn't render the MP3. Preview still plays in your browser.";
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

  const progress = lyricProgress(sections);
  const tempo = activeSong?.tempo ?? null;
  const tempoOutOfRange = tempo != null && (tempo < TEMPO_MIN || tempo > TEMPO_MAX);
  const keyValue = activeSong?.key ?? "";
  const sectionType = activeSection?.section_type ?? "verse";
  const sectionTypeKnown = SECTION_TYPES.some((t) => t.value === sectionType);
  const themeColumns = Math.min(MAX_THEME_COLUMNS, (album.central_themes ?? []).filter((t) => t.trim()).length);

  // One status region for saving. "Saved." shows briefly after an explicit save, then the time.
  const saveStatus = saving ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Saving…
    </>
  ) : saveError ? (
    <span>Couldn&apos;t save: {saveError}</span>
  ) : savedFlash ? (
    <span className="text-ok">{savedFlash}</span>
  ) : dirty ? (
    "Unsaved changes"
  ) : lastSavedAt ? (
    <span>
      Saved · <RelativeTime date={lastSavedAt} />
    </span>
  ) : (
    "No changes yet"
  );

  const saveBar = (
    <div ref={saveBarRef} className="sticky top-header z-20 -mx-4 border-b border-line bg-ground px-4 py-2 md:-mx-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p role="status" className={cn("flex min-h-11 items-center gap-2 text-sm", saveError ? "text-danger" : "text-ink-2")}>
            {saveStatus}
          </p>
          {saveError && !saving ? (
            <Button tone="secondary" onClick={() => void save("manual")}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          ) : null}
          {undo ? (
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
              <span id="studio-undo-text" className="min-w-0 break-words">
                Deleted “{undo.label}”.
              </span>
              <Button id="studio-undo" key={undo.key} tone="secondary" onClick={restoreDeleted} aria-describedby="studio-undo-text">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Undo
              </Button>
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0 text-xs text-ink-3">
            <span className="sm:hidden">
              <Kbd>Ctrl/⌘ S</Kbd> save · <Kbd>Alt ↑↓</Kbd> track
            </span>
            <span className="hidden sm:inline">
              Autosaves · <Kbd>Ctrl/⌘ S</Kbd> save · <Kbd>Alt ↑↓</Kbd> track · <Kbd>Alt Shift ↑↓</Kbd> section
            </span>
          </p>
          <Button tone="primary" onClick={() => void save("manual")} aria-keyshortcuts="Control+S Meta+S">
            <Save className="h-4 w-4" aria-hidden="true" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );

  const trackListStyle: CSSProperties | undefined =
    stickyTop != null ? { top: stickyTop, maxHeight: `calc(100dvh - ${stickyTop + 16}px)` } : undefined;

  const trackList = (
    <TrackList
      songs={songs}
      centralThemes={album.central_themes ?? []}
      activeIndex={songIndex}
      onSelect={selectSong}
      onAddTrack={addTrack}
      onAddThemes={() => openAlbumField(ALBUM_THEMES_INPUT_ID)}
      style={trackListStyle}
    />
  );

  const catalog = activeSong
    ? [
        `${sections.length} ${sections.length === 1 ? "section" : "sections"}`,
        `${progress.written} written`,
        activeSong.key || null,
        activeSong.tempo ? `${activeSong.tempo} bpm` : null,
      ].filter((part): part is string => Boolean(part))
    : [];

  const trackHeader = activeSong ? (
    <section aria-labelledby="studio-song-title" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 id="studio-song-title" className="text-2xl font-semibold text-ink">
            {/* Read as "Track 01: Title"; the big figure is the visual form of the same words. */}
            <span className="sr-only">{`Track ${pad2(activeSong.track_number)}: `}</span>
            <span aria-hidden="true" className="type-figure mr-3 text-3xl text-ink-3">
              {pad2(activeSong.track_number)}
            </span>
            <span className="break-words hyphens-auto">{activeSong.title || "Untitled"}</span>
          </h2>
          <p className="type-catalog mt-1 flex flex-wrap gap-x-2 text-xs text-ink-2">
            {catalog.map((part, i) => (
              <span key={i} className="type-figure flex gap-x-2">
                {i > 0 ? <span aria-hidden="true">·</span> : null}
                {part}
              </span>
            ))}
          </p>
          {/* The preview's own status; empty (and without height) until a preview starts. */}
          <div className="flex flex-wrap items-center gap-x-3">
            <p
              role="status"
              className={cn(
                "min-w-0 max-w-[65ch] text-sm",
                previewNote?.tone === "danger" ? "text-danger" : previewNote?.tone === "ok" ? "text-ok" : "text-ink-2",
              )}
            >
              {previewNote?.text ?? ""}
            </p>
            {previewNote?.retry && !previewing ? (
              <Button tone="secondary" className="mt-1" onClick={previewNote.retry}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button tone="secondary" onClick={previewSong} disabled={previewing}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Preview song
          </Button>
          <Button
            tone="danger"
            onClick={() => deleteTrack(songIndex)}
            aria-describedby="studio-delete-track-hint"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete track
          </Button>
          <span id="studio-delete-track-hint" className="sr-only">
            Removes this track and its sections. You can undo for 10 seconds.
          </span>
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
            aria-describedby={tempoOutOfRange ? "song-tempo-error" : undefined}
            className={cn(inputClass, "type-figure")}
            placeholder="120"
          />
        </Field>
      </div>
    </section>
  ) : null;

  const sectionEditor = activeSong ? (
    <Section
      id="studio-sections"
      title="Sections"
      className="pt-5"
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
                    aria-keyshortcuts="Alt+Shift+ArrowUp Alt+Shift+ArrowDown"
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
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <h3 className="text-base font-semibold text-ink">{activeLabel}</h3>
                  <p className="type-figure text-xs text-ink-3">
                    {sectionIndex + 1} of {sections.length}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button tone="secondary" onClick={previewSection} disabled={previewing}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Preview section
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

              <Field label="Lyrics draft" htmlFor="section-lyrics">
                <textarea
                  id="section-lyrics"
                  value={activeSection.lyrics ?? ""}
                  onChange={(e) => updateSectionField("lyrics", e.target.value)}
                  rows={10}
                  className={cn(textareaClass, "min-h-52 resize-y")}
                  placeholder="Write lyrics for this section…"
                />
              </Field>

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
                  hint={
                    <span className="block max-w-[65ch]">
                      Separate chords with spaces or commas. Loops of 4 to 8 chords export cleanly.
                    </span>
                  }
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
              <p id="studio-mp3-note" className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
                Previews play in your browser. MP3 downloads need audio rendering on the server, so
                they may not work on every install.
              </p>

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
                  <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
                    This album came in without stable section references. Save once to turn on
                    comments and shareable section links.
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

  const storyAndAi = activeSong ? (
    <div className="flex min-w-0 flex-col gap-6">
      <SongStoryEditor
        key={`story-${activeSong.id}`}
        song={activeSong}
        albumThemes={album.central_themes ?? []}
        albumMotifs={album.recurring_motifs ?? []}
        onChange={updateSongField}
        open={storyOpen}
        onOpenChange={setStoryOpen}
      />
      <SongDevelopmentAi
        key={`ai-${activeSong.id}`}
        albumId={albumId}
        songTitle={songTitle}
        trackNumber={activeSong.track_number}
        aiAvailable={aiAvailable}
      />
    </div>
  ) : null;

  const versionPanel = (
    <Section
      id="studio-version"
      title="Save a version"
      description={<span className="block max-w-[65ch]">A named snapshot of the album as it is now, kept in its version history.</span>}
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Version note"
          htmlFor="version-message"
          hint={<span className="block max-w-[65ch]">For example: tightened chorus, new bridge chords.</span>}
        >
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
      <p className="sr-only" aria-live="polite">
        {navAnnouncement}
      </p>
      <div
        className={cn(
          "grid min-w-0 grid-cols-1 items-start gap-x-8 gap-y-8 lg:grid-cols-[16rem_minmax(0,1fr)]",
          STUDIO_GRID_COLUMNS[themeColumns],
        )}
      >
        {trackList}

        <div className="@container flex min-w-0 flex-col gap-8">
          {songs.length ? (
            <>
              {trackHeader}
              {sectionEditor}
              {storyAndAi}
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
