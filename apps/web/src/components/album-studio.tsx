"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, Download, Loader2, Play, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { previewErrorMessage, usePlayerControls } from "@/components/player/player-provider";
import { previewFailureMessage } from "@/components/player/preview-errors";
import { RelativeTime } from "@/components/relative-time";
import { SectionComments } from "@/components/section-comments";
import { SongDevelopmentAi } from "@/components/song-development-ai";
import {
  ALBUM_CONCEPT_INPUT_ID,
  ALBUM_MOTIFS_INPUT_ID,
  ALBUM_THEMES_INPUT_ID,
  AlbumDetails,
  albumFocusTarget,
} from "@/components/studio/album-details";
import { previewBlockedMessage } from "@/components/studio/input-checks";
import { MoreMenu } from "@/components/studio/more-menu";
import { ChordField, TempoField } from "@/components/studio/musical-fields";
import { SongStoryEditor, STORY_FOCUS_TARGETS } from "@/components/studio/song-story-editor";
import { SECTION_KEYSHORTCUTS, studioShortcut } from "@/components/studio/studio-shortcuts";
import {
  KEY_OPTIONS,
  SECTION_TYPES,
  albumFrameKey,
  albumProblem,
  buildNewSection,
  buildNewSong,
  chordsOf,
  clampIndex,
  clampTempo,
  firstUnwrittenSection,
  isWritten,
  moveItem,
  moveTrack,
  nextToWrite,
  normalizeKey,
  normalizeOrders,
  normalizeTrackNumbers,
  parseInitialAlbum,
  readApiError,
  sectionLabels,
  sectionTypeLabel,
  saveStatusParts,
  toggleTheme,
  type SaveMode,
  type StudioAlbum,
  type StudioSection,
  type StudioSong,
} from "@/components/studio/studio-model";
import {
  MAX_THEME_COLUMNS,
  STUDIO_GRID_BASE,
  STUDIO_GRID_COLUMNS,
  TrackList,
  pad2,
} from "@/components/studio/track-list";
import { Button, EmptyState, Field, Section, inputClass, selectClass, textareaClass } from "@/components/ui";
import { invalidChords } from "@/lib/chords";
import { lyricProgress } from "@/lib/lyrics";
import { cn } from "@/lib/utils";

type SelectionInput = {
  song?: string;
  section?: string;
  sid?: string;
  q?: string;
  /**
   * Deep-link focus, always with `song=<trackNumber>` for the track-level ones:
   * story (Story note) | role | song-themes | motifs: open the song's story, focus that field.
   * album (the first empty album field) | album-motifs: open Album details, focus that field.
   * lyrics: select the song's first unwritten section and focus its lyrics.
   * Older links keep working: themes = song-themes, position = role, album-themes, album-concept.
   */
  focus?: string;
};

type AlbumStudioProps = {
  albumId: string;
  initialAlbum: unknown;
  initialSelection?: SelectionInput;
  /** From `getAgentAvailability()`: false when AI drafts can't run on this server. */
  aiAvailable?: boolean;
  /** The workspace's credit balance, so an AI draft can confirm "You'll have N left." */
  creditsRemaining?: number;
};

type UndoEntry =
  | { kind: "track"; song: StudioSong; index: number; label: string; key: number }
  | { kind: "section"; songId: string; section: StudioSection; index: number; label: string; key: number };

/** A preview's status, shown beside the control that asked for it (the track's or the section's). */
type PreviewNote = {
  scope: "track" | "section";
  tone: "neutral" | "ok" | "danger";
  text: string;
  retry?: () => void;
  /** The Retry button's accessible name, unique on the page ("Retry preview", "Retry MP3"). */
  retryLabel?: string;
};

/**
 * Where focus goes next and how the page may move to show it. "start" brings `scrollTo` (or
 * the target) to the top of the view, under the sticky bar, e.g. the section's heading above
 * its lyrics.
 */
type PendingFocus = { id: string; scroll: "center" | "nearest" | "start" | "none"; scrollTo?: string };

/** The Studio's in-page targets: the editor column, and the current section's editor. */
const EDITOR_ID = "studio-editor";
const SECTION_EDITOR_ID = "studio-section-editor";
const PREVIEW_CHORD_LIMIT = 128;

const AUTOSAVE_DELAY_MS = 2000;
/** Adding, deleting or moving a track saves almost at once, so the header and spine follow. */
const STRUCTURAL_SAVE_DELAY_MS = 400;
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
  } else if (selection?.focus === "lyrics") {
    section = Math.max(0, firstUnwrittenSection(sections));
  }
  return { song, section };
}

type FocusTarget = { id: string; opens: "story" | "details" | null };

/** A deep-link `focus` value → the field to focus and the disclosure that holds it. */
function focusTargetFor(focus: string | undefined | null, album: StudioAlbum): FocusTarget | null {
  switch (focus) {
    case "story":
      return { id: STORY_FOCUS_TARGETS.story, opens: "story" };
    case "role":
    case "position":
      return { id: STORY_FOCUS_TARGETS.role, opens: "story" };
    case "themes":
    case "song-themes":
      return { id: STORY_FOCUS_TARGETS.themes, opens: "story" };
    case "motifs":
      return { id: STORY_FOCUS_TARGETS.motifs, opens: "story" };
    case "album":
      return { id: albumFocusTarget(album), opens: "details" };
    case "album-themes":
      return { id: ALBUM_THEMES_INPUT_ID, opens: "details" };
    case "album-concept":
      return { id: ALBUM_CONCEPT_INPUT_ID, opens: "details" };
    case "album-motifs":
      return { id: ALBUM_MOTIFS_INPUT_ID, opens: "details" };
    case "lyrics":
      return { id: "section-lyrics", opens: null };
    default:
      return null;
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Kbd({ children }: { children: string }) {
  return <kbd className="type-figure rounded-sm border border-line px-1 font-sans text-xs text-ink-2">{children}</kbd>;
}

/** "Track 4, " when the next section to write is on another track. */
function trackPrefix(song: StudioSong | undefined) {
  return song ? `Track ${song.track_number}, ` : "";
}

function useAlbumStudioRender({
  albumId,
  initialAlbum,
  initialSelection,
  aiAvailable = false,
  creditsRemaining,
}: AlbumStudioProps) {
  const router = useRouter();
  const player = usePlayerControls();
  const initialParsed = useMemo(() => parseInitialAlbum(initialAlbum), [initialAlbum]);
  const initialTarget = focusTargetFor(initialSelection?.focus, initialParsed.album);

  const [album, setAlbum] = useState<StudioAlbum>(initialParsed.album);
  const [selection, setSelection] = useState(() => resolveSelection(initialParsed.album, initialSelection));
  const [versionMessage, setVersionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<SaveMode>("auto");
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
  const [versionOpen, setVersionOpen] = useState(false);
  // A link to one section (`sid`, e.g. from Comments and tasks) opens its comments.
  const [commentsOpenAtStart] = useState(() => Boolean(initialSelection?.sid));
  const [navAnnouncement, setNavAnnouncement] = useState("");

  const albumRef = useRef(album);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef<SaveMode | null>(null);
  const frameKeyRef = useRef(albumFrameKey(album));
  const structuralRef = useRef(false);
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
    const target = focusTargetFor(initialSelection?.focus, album);
    if (target) {
      setPendingFocus({ id: target.id, scroll: "center" });
      if (target.opens === "story") setStoryOpen(true);
      else if (target.opens === "details") setDetailsOpen(true);
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

  // The sticky stack (app header + save bar) is measured, not assumed, and published as
  // --sticky-offset on <html> while the Studio is mounted: the page's scroll padding and the
  // fields' scroll margin read it, so a focused field never hides under the bar, and the track
  // list sticks just below it. It follows the bar's real height (it grows while Undo is
  // offered) and drops the bar when the bar stops sticking on short screens.
  useEffect(() => {
    const bar = saveBarRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const header = bar.closest("main")?.previousElementSibling;
    const appHeader = header instanceof HTMLElement && header.tagName === "HEADER" ? header : null;
    const stuck = (el: HTMLElement) => /^(sticky|fixed)$/.test(getComputedStyle(el).position);
    const measure = () => {
      const headerHeight = appHeader && stuck(appHeader) ? appHeader.getBoundingClientRect().height : 0;
      const barHeight = stuck(bar) ? bar.getBoundingClientRect().height : 0;
      root.style.setProperty("--sticky-offset", `${Math.round(headerHeight + barHeight)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    if (appHeader) observer.observe(appHeader);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--sticky-offset");
    };
  }, []);

  // Moves focus once the target exists: a deep-linked field, a restored row, Undo.
  useEffect(() => {
    if (!pendingFocus) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(pendingFocus.id);
      if (el) {
        el.focus({ preventScroll: true });
        // "none" keeps the page still unless the target is out of sight (e.g. Undo in the
        // save bar on a short screen, where the bar scrolls away with the page).
        const rect = el.getBoundingClientRect();
        const offScreen = rect.bottom < 0 || rect.top > window.innerHeight;
        if (pendingFocus.scroll !== "none" || offScreen) {
          const scrollEl = (pendingFocus.scrollTo && document.getElementById(pendingFocus.scrollTo)) || el;
          // The page's scroll padding (globals.css, from --sticky-offset) keeps it clear of
          // the header and save bar; nothing here adds its own offset.
          scrollEl.scrollIntoView({
            block: pendingFocus.scroll === "none" ? "nearest" : pendingFocus.scroll,
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
    setSavingMode(mode);
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
      // The album's shared frame (release header, track count, spine on the other tabs) is
      // rendered by the layout; refresh it whenever this save changed something it shows.
      const frameKey = albumFrameKey(snapshot);
      if (frameKey !== frameKeyRef.current) {
        frameKeyRef.current = frameKey;
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

  // Autosave ~2s after the last edit (sooner after a structural change), only when there is
  // something to save and nothing in flight.
  useEffect(() => {
    if (!dirty || saving || saveError) return;
    const delay = structuralRef.current ? STRUCTURAL_SAVE_DELAY_MS : AUTOSAVE_DELAY_MS;
    const timer = window.setTimeout(() => {
      structuralRef.current = false;
      void saveRef.current("auto");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [album, dirty, saving, saveError]);

  // Ctrl/⌘+S saves; Alt+PageUp/PageDown (anywhere) and Alt+↑/↓ (outside text fields) move
  // between tracks, with Shift between sections. See studio-shortcuts.ts for the rules.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = studioShortcut(event, event.target instanceof Element ? (event.target as HTMLElement) : null);
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut.kind === "save") void saveRef.current("manual");
      else stepRef.current(shortcut.what, shortcut.dir);
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

  /**
   * Selecting from the track list. In one column (a phone, enlarged text) the editor sits below
   * the whole list, so the page brings up the track's lyrics: the current section's heading
   * and its Lyrics draft, just under the save bar, which names the track. Focus stays on the
   * row, so no keyboard opens on a phone.
   */
  function openTrack(index: number) {
    selectSong(index);
    requestAnimationFrame(() => {
      const editor = document.getElementById(EDITOR_ID);
      const list = document.getElementById("studio-tracks-title")?.closest("section");
      if (!editor || !list) return;
      const stacked = editor.getBoundingClientRect().top >= list.getBoundingClientRect().bottom - 1;
      if (!stacked) return;
      const target = document.getElementById(SECTION_EDITOR_ID) ?? document.getElementById("studio-track");
      target?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  }

  /** The Studio's skip link: straight to the current section's lyrics (or the track's title). */
  function skipToLyrics() {
    if (activeSection) setPendingFocus({ id: "section-lyrics", scroll: "start", scrollTo: SECTION_EDITOR_ID });
    else if (activeSong) setPendingFocus({ id: "song-title", scroll: "start", scrollTo: "studio-track" });
    else setPendingFocus({ id: EDITOR_ID, scroll: "start" });
  }

  function addTrack() {
    const index = songs.length;
    structuralRef.current = true;
    edit((prev) => ({ ...prev, songs: [...prev.songs, buildNewSong(prev.songs.length + 1)] }));
    setSelection({ song: index, section: 0 });
    setPendingFocus({ id: "song-title", scroll: "nearest" });
  }

  // Deleting never moves the page: the next item is selected in place and focus goes to Undo,
  // which sits in the sticky save bar.
  function deleteTrack(index: number) {
    const song = songs[index];
    if (!song) return;
    structuralRef.current = true;
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
      structuralRef.current = true;
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
    const section = sections[index];
    if (!section || !moveItem(sections, index, target)) return;
    updateSections(activeSong?.id, (list) => moveItem(list, index, target) ?? list);
    setSelection({ song: songIndex, section: target });
    setNavAnnouncement(`${sectionTypeLabel(section.section_type)} moved to section ${target + 1} of ${sections.length}.`);
  }

  /** Moves a track one place and renumbers the album; the moved track stays selected. */
  function moveTrackBy(index: number, dir: -1 | 1) {
    const song = songs[index];
    if (!song || !moveTrack(songs, index, dir)) return;
    structuralRef.current = true;
    edit((prev) => ({ ...prev, songs: moveTrack(prev.songs, index, dir) ?? prev.songs }));
    setSelection({ song: index + dir, section: sectionIndex });
    setNavAnnouncement(`Moved “${song.title || "Untitled"}” to track ${index + dir + 1} of ${songs.length}.`);
  }

  /** The track list's theme toggles: tag or untag one track with one central theme. */
  function toggleTrackTheme(index: number, theme: string) {
    edit((prev) => ({
      ...prev,
      songs: prev.songs.map((song, i) => (i === index ? { ...song, themes: toggleTheme(song.themes, theme) } : song)),
    }));
  }

  const upNext = activeSong ? nextToWrite(songs, songIndex, sectionIndex) : null;

  function writeNext() {
    if (!upNext) return;
    const song = songs[upNext.song];
    setSelection(upNext);
    setPendingFocus({ id: "section-lyrics", scroll: "nearest" });
    const label = sectionLabels(song?.sections ?? [])[upNext.section] ?? "Section";
    setNavAnnouncement(upNext.song === songIndex ? label : `Track ${song?.track_number}: ${song?.title || "Untitled"}, ${label}`);
  }

  function openAlbumField(id: string) {
    setDetailsOpen(true);
    setPendingFocus({ id, scroll: "center" });
  }

  // ------------------------------------------------------------------ previews

  const songTitle = activeSong ? activeSong.title || `Track ${activeSong.track_number}` : "";

  /**
   * Renders the chords on the server and loads them into the player. Every failure is said
   * where the preview was asked for, with its cause and Retry; the docked player only opens
   * for a preview that loaded.
   */
  async function previewFromChords(chords: string[], subtitle: string, scope: PreviewNote["scope"], openerId: string) {
    const retry = () => void previewFromChords(chords, subtitle, scope, openerId);
    const fail = (text: string) => setPreviewNote({ scope, tone: "danger", text, retry });
    const clipped = chords.length > PREVIEW_CHORD_LIMIT;
    setPreviewing(true);
    setPreviewNote({ scope, tone: "neutral", text: "Rendering preview…" });
    // Best effort: unlock audio on this click so playback can start right away.
    void player.arm().catch(() => null);
    try {
      let response: Response;
      try {
        response = await fetch("/api/midi/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chords: chords.slice(0, PREVIEW_CHORD_LIMIT),
            tempo: clampTempo(activeSong?.tempo),
            barsPerChord: 1,
            title: songTitle,
          }),
        });
      } catch {
        fail(previewFailureMessage("offline"));
        return;
      }
      if (!response.ok) {
        fail(
          await readApiError(
            response,
            "Couldn't render this preview: the server couldn't turn these chords into sound. Retry in a minute.",
          ),
        );
        return;
      }
      const midi = await response.arrayBuffer();
      try {
        await player.loadMidi({ midi, title: songTitle, subtitle, returnFocusId: openerId });
      } catch (err) {
        fail(previewErrorMessage(err));
        return;
      }
      setPreviewNote(
        clipped
          ? { scope, tone: "neutral", text: `Previewing the first ${PREVIEW_CHORD_LIMIT} chords of this track.` }
          : null,
      );
      try {
        await player.play();
      } catch {
        setPreviewNote({ scope, tone: "neutral", text: "Preview loaded. Press Play in the player to start it." });
      }
    } finally {
      setPreviewing(false);
    }
  }

  async function downloadMp3(chords: string[], subtitle: string) {
    const retry = () => void downloadMp3(chords, subtitle);
    const failed = "Couldn't render the MP3: the server couldn't turn these chords into audio. Previews still play in your browser.";
    setPreviewing(true);
    setPreviewNote({ scope: "section", tone: "neutral", text: "Rendering MP3…" });
    try {
      const response = await fetch("/api/audio/preview/mp3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chords, tempo: clampTempo(activeSong?.tempo), barsPerChord: 1, title: songTitle }),
      });
      if (!response.ok) {
        setPreviewNote({ scope: "section", tone: "danger", text: await readApiError(response, failed), retry, retryLabel: "Retry MP3" });
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
      setPreviewNote({ scope: "section", tone: "ok", text: "MP3 downloaded." });
    } catch {
      setPreviewNote({ scope: "section", tone: "danger", text: previewFailureMessage("offline"), retry, retryLabel: "Retry MP3" });
    } finally {
      setPreviewing(false);
    }
  }

  /** Chords the exports can't read stop a preview before it starts, naming them. */
  function blockedBy(list: StudioSection[], scope: PreviewNote["scope"]) {
    const flagged = list.filter((section) => invalidChords(section.chord_progression).length);
    if (!flagged.length) return false;
    const bad = flagged.flatMap((section) => invalidChords(section.chord_progression));
    // The whole-track preview says which sections to fix; a section's own preview needn't.
    const where = scope === "track" ? flagged.map((section) => labels[sections.indexOf(section)] ?? "Section") : [];
    setPreviewNote({ scope, tone: "danger", text: previewBlockedMessage(bad, where) });
    return true;
  }

  function previewSection() {
    const chords = chordsOf(activeSection);
    if (!chords.length) {
      setPreviewNote({ scope: "section", tone: "neutral", text: "Add a chord progression to preview this section." });
      return;
    }
    if (activeSection && blockedBy([activeSection], "section")) return;
    void previewFromChords(chords, activeLabel, "section", "preview-section");
  }

  function previewSong() {
    const chords = sections.flatMap((section) => chordsOf(section));
    if (!chords.length) {
      setPreviewNote({ scope: "track", tone: "neutral", text: "Add chord progressions to the sections to preview this track." });
      return;
    }
    if (blockedBy(sections, "track")) return;
    void previewFromChords(chords, "Whole track", "track", "preview-song");
  }

  function downloadSectionMp3() {
    const chords = chordsOf(activeSection);
    if (!chords.length) {
      setPreviewNote({ scope: "section", tone: "neutral", text: "Add a chord progression to render an MP3." });
      return;
    }
    if (activeSection && blockedBy([activeSection], "section")) return;
    void downloadMp3(chords, activeLabel);
  }

  // ------------------------------------------------------------------ render

  const progress = lyricProgress(sections);
  // Shorthand keys ("C", "Am") read as the select's own spelling, so both agree.
  const keyValue = normalizeKey(activeSong?.key) ?? "";
  const sectionType = activeSection?.section_type ?? "verse";
  const sectionTypeKnown = SECTION_TYPES.some((t) => t.value === sectionType);
  const themeColumns = Math.min(MAX_THEME_COLUMNS, (album.central_themes ?? []).filter((t) => t.trim()).length);

  // Saving has one live region, and it speaks only for events: a save the artist asked for
  // ("Saving…", then "Saved."), and a save that failed. Autosave's quiet cycle and the ticking
  // "Saved · 3 minutes ago" sit beside it, readable but never announced.
  const status = saveStatusParts({ saving, mode: savingMode, error: saveError, flash: savedFlash, dirty, lastSavedAt });
  const liveStatus = status.live;
  const quietStatus =
    status.quiet === "saving" ? (
      "Saving…"
    ) : status.quiet === "unsaved" ? (
      "Unsaved changes"
    ) : status.quiet === "saved-at" && lastSavedAt ? (
      <>
        Saved · <RelativeTime date={lastSavedAt} />
      </>
    ) : status.quiet === "no-changes" ? (
      "No changes yet"
    ) : null;

  const currentTrack = activeSong ? `${pad2(activeSong.track_number)} · ${activeSong.title.trim() || "Untitled"}` : null;

  // One quiet row: the current track (so a phone writer knows where they are while typing), the
  // save status, Undo while it is offered, keyboard hints (only with a fine pointer and room for
  // them) and a ghost "Save now". Autosave does the saving; the saffron on this screen belongs
  // to the next step of the writing. On short screens (a phone on its side) the bar scrolls
  // away with the page instead of sticking.
  const saveBar = (
    <div
      ref={saveBarRef}
      className="z-20 -mx-4 border-b border-line bg-ground px-4 py-0.5 md:-mx-8 md:px-8 [@media(min-height:501px)]:sticky [@media(min-height:501px)]:top-header"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <div className="flex min-h-11 min-w-0 flex-1 basis-40 flex-col justify-center">
          {currentTrack ? (
            <p className="type-figure truncate text-sm font-semibold text-ink" title={currentTrack}>
              <span className="sr-only">Track </span>
              {currentTrack}
            </p>
          ) : null}
          {/* The live and the quiet status never both hold text, so no gap between them. */}
          <p className={cn("flex min-w-0 items-center text-sm", saveError ? "text-danger" : "text-ink-2")}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 flex-none animate-spin" aria-hidden="true" /> : null}
            <span role="status" className={cn("min-w-0 break-words", savedFlash && !saving && !saveError && "text-ok")}>
              {liveStatus}
            </span>
            {quietStatus ? <span className="min-w-0 break-words">{quietStatus}</span> : null}
          </p>
        </div>
        {saveError && !saving ? (
          <Button tone="secondary" onClick={() => void save("manual")} aria-label="Retry save">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
        {undo ? (
          <span className="flex min-w-0 items-center gap-x-2 text-sm text-ink">
            <span id="studio-undo-text" className="min-w-0 max-w-[24ch] truncate" title={`Deleted “${undo.label}”.`}>
              Deleted “{undo.label}”.
            </span>
            <Button id="studio-undo" key={undo.key} tone="secondary" onClick={restoreDeleted} aria-describedby="studio-undo-text">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Undo
            </Button>
          </span>
        ) : null}
        <div className="contents pointer-coarse:hidden">
          <p className="hidden min-w-0 text-xs text-ink-3 lg:block">
            <Kbd>Ctrl/⌘ S</Kbd> save · <Kbd>Alt PgUp/PgDn</Kbd> track · with <Kbd>Shift</Kbd> section
          </p>
        </div>
        <Button tone="ghost" onClick={() => void save("manual")} disabled={saving} aria-keyshortcuts="Control+S Meta+S">
          <Save className="h-4 w-4" aria-hidden="true" />
          Save now
        </Button>
      </div>
    </div>
  );

  /**
   * A preview's status and Retry, beside the control that asked for it. Both scopes keep their
   * live region mounted (empty, without height) so the first message is announced.
   */
  function previewStatus(scope: PreviewNote["scope"]) {
    const note = previewNote?.scope === scope ? previewNote : null;
    return (
      <div className="flex flex-wrap items-center gap-x-3">
        <p
          role="status"
          className={cn(
            "min-w-0 max-w-[65ch] text-sm",
            note?.tone === "danger" ? "text-danger" : note?.tone === "ok" ? "text-ok" : "text-ink-2",
          )}
        >
          {note?.text ?? ""}
        </p>
        {note?.retry && !previewing ? (
          <Button tone="secondary" className="mt-1" onClick={note.retry} aria-label={note.retryLabel ?? "Retry preview"}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  const trackList = (
    <TrackList
      songs={songs}
      centralThemes={album.central_themes ?? []}
      activeIndex={songIndex}
      onSelect={openTrack}
      onToggleTheme={toggleTrackTheme}
      onAddTrack={addTrack}
      onAddThemes={() => openAlbumField(ALBUM_THEMES_INPUT_ID)}
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
    <section id="studio-track" aria-labelledby="studio-song-title" className="flex min-w-0 flex-col gap-4">
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
          {previewStatus("track")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button id="preview-song" tone="secondary" onClick={previewSong} disabled={previewing}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Preview song
          </Button>
          <MoreMenu
            label="track actions"
            items={[
              {
                key: "up",
                label: "Move track up",
                icon: <ArrowUp className="h-4 w-4" aria-hidden="true" />,
                disabled: songIndex === 0,
                onSelect: () => moveTrackBy(songIndex, -1),
              },
              {
                key: "down",
                label: "Move track down",
                icon: <ArrowDown className="h-4 w-4" aria-hidden="true" />,
                disabled: songIndex >= songs.length - 1,
                onSelect: () => moveTrackBy(songIndex, 1),
              },
              {
                key: "delete",
                label: "Delete track",
                hint: "Removes the track and its sections. You can undo for 10 seconds.",
                icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                danger: true,
                onSelect: () => deleteTrack(songIndex),
              },
            ]}
          />
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
            {/* A key outside the list ("D dorian") stays selectable as written. */}
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
        <TempoField
          key={`tempo-${activeSong.id}`}
          id="song-tempo"
          className="min-w-0"
          value={activeSong.tempo}
          onChange={(next) => updateSongField("tempo", next)}
          onClamped={setNavAnnouncement}
        />
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
                    aria-keyshortcuts={SECTION_KEYSHORTCUTS}
                    className={cn(
                      "relative flex min-h-11 w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors",
                      // The current row's fill and weight vanish in forced colors (High
                      // Contrast), so it also carries a transparent frame drawn there in Highlight.
                      isActive
                        ? "bg-selected text-ink after:pointer-events-none after:absolute after:inset-0 after:border-2 after:border-transparent after:content-[''] forced-colors:after:border-[color:Highlight]"
                        : "text-ink-2 hover:bg-hover hover:text-ink",
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cn("block break-words text-sm", isActive && "font-semibold")}>{labels[index]}</span>
                      <span className="type-figure block break-words text-xs text-ink-3">
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
            <div id={SECTION_EDITOR_ID} className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <h3 className="text-base font-semibold text-ink">{activeLabel}</h3>
                    <p className="type-figure text-xs text-ink-3">
                      {sectionIndex + 1} of {sections.length}
                    </p>
                  </div>
                  {previewStatus("section")}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button id="preview-section" tone="secondary" onClick={previewSection} disabled={previewing}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Preview section
                  </Button>
                  <MoreMenu
                    label="section actions"
                    items={[
                      {
                        key: "mp3",
                        label: "Download MP3",
                        hint: "Needs audio rendering on the server, so it may not work on every install. Previews always play in your browser.",
                        icon: <Download className="h-4 w-4" aria-hidden="true" />,
                        disabled: previewing,
                        onSelect: downloadSectionMp3,
                      },
                      {
                        key: "up",
                        label: "Move section up",
                        icon: <ArrowUp className="h-4 w-4" aria-hidden="true" />,
                        disabled: sectionIndex === 0,
                        onSelect: () => moveSection(sectionIndex, -1),
                      },
                      {
                        key: "down",
                        label: "Move section down",
                        icon: <ArrowDown className="h-4 w-4" aria-hidden="true" />,
                        disabled: sectionIndex >= sections.length - 1,
                        onSelect: () => moveSection(sectionIndex, 1),
                      },
                      {
                        key: "delete",
                        label: "Delete section",
                        hint: "You can undo for 10 seconds.",
                        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                        danger: true,
                        onSelect: () => deleteSection(sectionIndex),
                      },
                    ]}
                  />
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
                <ChordField
                  key={activeSection.id}
                  id="section-chords"
                  value={activeSection.chord_progression}
                  onChange={(chords) => updateSectionField("chord_progression", chords)}
                />
              </div>
              {upNext ? (
                <div>
                  <Button tone="primary" onClick={writeNext}>
                    Write next: {upNext.song === songIndex ? "" : trackPrefix(songs[upNext.song])}
                    {sectionLabels(songs[upNext.song]?.sections ?? [])[upNext.section] ?? "Section"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}

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
                  defaultOpen={commentsOpenAtStart}
                />
              ) : (
                <section aria-labelledby="comments-pending-title" className="border-t border-line pt-3">
                  <h3 id="comments-pending-title" className="text-base font-semibold text-ink">
                    Comments
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3">
                    <p className="min-w-0 max-w-[65ch] text-sm leading-relaxed text-ink-2">
                      Comments and section links turn on after the first save.
                    </p>
                    <Button tone="ghost" onClick={() => void save("manual")} disabled={saving}>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save to turn on comments
                    </Button>
                  </div>
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
        creditsRemaining={creditsRemaining}
      />
    </div>
  ) : null;

  // Collapsed like Album details: a named snapshot is an occasional act, not part of writing.
  const versionPanel = (
    <section id="studio-version" aria-labelledby="studio-version-title" className="min-w-0 border-t border-line pt-5">
      <h2 id="studio-version-title" className="text-lg font-semibold text-ink">
        <button
          type="button"
          aria-expanded={versionOpen}
          aria-controls="studio-version-body"
          onClick={() => setVersionOpen(!versionOpen)}
          className="-mx-2 inline-flex min-h-11 items-center gap-2 rounded px-2 transition-colors hover:bg-hover"
        >
          Save a version
          <ChevronDown className={cn("h-4 w-4 transition-transform", versionOpen && "rotate-180")} aria-hidden="true" />
        </button>
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
        A named snapshot of the album as it is now, kept in its version history.
      </p>
      <div id="studio-version-body" hidden={!versionOpen} className="mt-4 flex-col gap-3 [&:not([hidden])]:flex">
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
    </section>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* The first stop inside the album content: past the save bar and the whole track list,
          straight to the current section's lyrics. Visible on focus, like the app's skip link. */}
      {songs.length ? (
        <a
          href={`#${EDITOR_ID}`}
          onClick={(event) => {
            event.preventDefault();
            skipToLyrics();
          }}
          className="sr-only z-50 rounded bg-accent text-sm font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4 focus:py-3"
        >
          Skip to the lyrics
        </a>
      ) : null}
      {saveBar}
      <p className="sr-only" aria-live="polite">
        {navAnnouncement}
      </p>
      {/* The columns follow the room the Studio has (rem container queries), so enlarged text
          folds it to one column. Fields keep clear of the sticky header and save bar through
          the page's scroll padding alone (globals.css reads --sticky-offset, set above). */}
      <div className="@container min-w-0">
      <div
        className={cn(
          "grid min-w-0 grid-cols-1 items-start gap-x-8 gap-y-8",
          STUDIO_GRID_BASE,
          STUDIO_GRID_COLUMNS[themeColumns],
        )}
      >
        {trackList}

        <div id={EDITOR_ID} className="@container flex min-w-0 flex-col gap-8">
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
    </div>
  );
}

export function AlbumStudio(props: AlbumStudioProps) {
  return useAlbumStudioRender(props);
}
