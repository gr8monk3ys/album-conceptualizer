"use client";

import { memo, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CircleHelp,
  Copy,
  Download,
  History,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import { CatalogItems } from "@/components/album-card";
import { previewErrorMessage, usePlayerControls } from "@/components/player/player-provider";
import { previewFailureMessage } from "@/components/player/preview-errors";
import { RelativeTime } from "@/components/relative-time";
import { SectionComments } from "@/components/section-comments";
import { LeavePrompt } from "@/components/sound-nav";
import { SongDevelopmentAi } from "@/components/song-development-ai";
import {
  ALBUM_CONCEPT_INPUT_ID,
  ALBUM_MOTIFS_INPUT_ID,
  ALBUM_THEMES_INPUT_ID,
  AlbumDetails,
  albumFocusTarget,
} from "@/components/studio/album-details";
import { previewBlockedMessage } from "@/components/studio/input-checks";
import { DeleteConfirm, deleteSectionQuestion, deleteTrackQuestion } from "@/components/studio/delete-confirm";
import { MoreMenu } from "@/components/studio/more-menu";
import { MoveTrackForm } from "@/components/studio/move-track-form";
import { TRACKS_TOGGLE_ID, useTracksOpen } from "@/components/studio/tracks-disclosure";
import { ChordField, TempoField } from "@/components/studio/musical-fields";
import { SongStoryEditor, SongStoryFields, STORY_FOCUS_TARGETS } from "@/components/studio/song-story-editor";
import {
  STICKY_MIN_HEIGHT_QUERY,
  frameWithTarget,
  saveBarSticks,
  visibleBelowSticky,
} from "@/components/studio/sticky-stack";
import {
  MOVE_TRACK_DOWN_KEYSHORTCUTS,
  MOVE_TRACK_UP_KEYSHORTCUTS,
  SECTION_KEYSHORTCUTS,
  studioShortcut,
} from "@/components/studio/studio-shortcuts";
import {
  KEY_OPTIONS,
  SECTION_TYPES,
  albumFrameKey,
  albumProblem,
  applyProgressionToType,
  batchChordsSummary,
  buildNewSection,
  buildNewSong,
  chordsOf,
  clampIndex,
  clampTempo,
  firstUnwrittenSection,
  isStarterLoopSection,
  isWritten,
  mergeRenames,
  moveItem,
  moveTrackTo,
  moveUndoLabel,
  nextToWrite,
  normalizeKey,
  normalizeOrders,
  removeTrack,
  renumberTracks,
  restoreTrack,
  parseInitialAlbum,
  readApiError,
  restoreProgressions,
  sameTypeTargets,
  sectionChordSummary,
  sectionLabels,
  sectionTypeLabel,
  saveStatusParts,
  toggleTheme,
  trackRenames,
  tracksSharingTitle,
  undoTrackMove,
  unreadableChordsOnAlbum,
  unreadableChordsStatus,
  type ChordSnapshot,
  type TrackRename,
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
  TrackThemeToggles,
  pad2,
} from "@/components/studio/track-list";
import { TrackTitle, TRACK_TITLE_ID } from "@/components/studio/track-title";
import { useUndoWindow } from "@/components/studio/undo-window";
import { sameKeys, useStableEvent } from "@/components/studio/use-stable-event";
import { Button, EmptyState, Field, inputClass, selectClass, textareaClass } from "@/components/ui";
import { invalidChords } from "@/lib/chords";
import { lyricProgress } from "@/lib/lyrics";
import { useLeaveGuard } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";

type SelectionInput = {
  song?: string;
  section?: string;
  sid?: string;
  q?: string;
  /**
   * Deep-link focus, always with `song=<trackNumber>` for the track-level ones:
   * story (Story note) | role: focus that field, under the track title.
   * song-themes | motifs: open the track's "Themes and motifs", focus that field.
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
  /**
   * How the artist got here, when the Studio should say so once (`?remixed=1`, set by Remix):
   * "Remixed into your workspace · 45 credits left" in the save bar until the first edit.
   */
  arrival?: "remixed" | null;
};

type UndoEntry =
  | { kind: "track"; song: StudioSong; index: number; label: string; key: number }
  | { kind: "section"; songId: string; section: StudioSection; index: number; label: string; key: number }
  /**
   * A track moved (one place or several, by the menu, Move to position or the shortcut): Undo
   * puts it back at `from`, where it was before the first of a run of moves, with every name
   * the moves changed (`renamed`) as it was. `fromTitle` is what it was called there; `label`
   * is the line beside Undo.
   */
  | { kind: "move"; songId: string; from: number; fromTitle: string; renamed: TrackRename[]; label: string; key: number }
  | {
      kind: "chords";
      songId: string;
      /** The section whose chords were copied, reselected (and its button refocused) on Undo. */
      sourceIndex: number;
      previous: ChordSnapshot[];
      /** The changed sections' labels, for the announcement when Undo puts them back. */
      targets: string[];
      /** What changed, said in the save bar beside Undo ("Set Verse 2 and Verse 3 to C G Am F."). */
      label: string;
      key: number;
    };

/** The save bar's line beside Undo: what the undoable change did. */
function undoText(entry: UndoEntry) {
  return entry.kind === "chords" || entry.kind === "move" ? entry.label : `Deleted “${entry.label}”.`;
}

/** "Remixed into your workspace · 45 credits left". */
function arrivalText(arrival: AlbumStudioProps["arrival"], credits: number | undefined) {
  if (arrival !== "remixed") return null;
  if (typeof credits !== "number") return "Remixed into your workspace";
  return `Remixed into your workspace · ${credits} ${credits === 1 ? "credit" : "credits"} left`;
}

/** A preview's status, shown beside the control that asked for it (the track's or the section's). */
type PreviewNote = {
  scope: "track" | "section";
  tone: "neutral" | "ok" | "danger";
  text: string;
  retry?: () => void;
  /** The Retry button's accessible name, unique on the page ("Retry preview", "Retry MP3"). */
  retryLabel?: string;
};

/** The Retry button beside each scope's preview status. */
const RETRY_IDS: Record<PreviewNote["scope"], string> = {
  track: "preview-retry-track",
  section: "preview-retry-section",
};

function focusedId() {
  return typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement.id : "";
}

/**
 * Where focus goes next and how the page may move to show it. "start" brings `scrollTo` (or
 * the target) to the top of the view, under the sticky bar, e.g. the section's heading above
 * its lyrics. `frame` names what should be seen with the target when both fit below the
 * sticky layers (the track's header above its lyrics); then the frame goes to the top instead.
 */
type PendingFocus = {
  id: string;
  scroll: "center" | "nearest" | "start" | "none";
  scrollTo?: string;
  frame?: string;
};

/** One empty list for every "not set yet", so memoized children see the same value each render. */
const NO_ITEMS: string[] = [];

// Every keystroke re-renders the Studio (it owns the album). These parts don't change with the
// lyrics, so they skip those renders: the AI draft panel (plain props) and the section's
// comments (the section is compared by what they show of it).
const SongDevelopmentAiMemo = memo(SongDevelopmentAi);
type SectionCommentsProps = ComponentProps<typeof SectionComments>;
const SectionCommentsMemo = memo(
  SectionComments,
  (prev: SectionCommentsProps, next: SectionCommentsProps) =>
    sameKeys(prev, next, ["albumId", "defaultOpen"]) &&
    sameKeys(prev.section, next.section, ["id", "songTrackNumber", "sectionType", "sectionOrder", "label"]),
);

/** The track's header ("01 Track 1", Preview song, More, the catalog line). */
const TRACK_HEADER_ID = "studio-track";

/** Arriving at the lyrics (a "Write track" link, Write next): shown with the track's header. */
function lyricsArrival(scroll: PendingFocus["scroll"]): PendingFocus {
  return { id: "section-lyrics", scroll, frame: TRACK_HEADER_ID };
}

/** A deep link's field, centred; the lyrics (`focus=lyrics`) come with their track's header. */
function arrivalFocus(target: FocusTarget): PendingFocus {
  return target.id === "section-lyrics" ? lyricsArrival("center") : { id: target.id, scroll: "center" };
}

/** The Studio's in-page targets: the editor column, and the current section's editor. */
const EDITOR_ID = "studio-editor";
const SECTION_EDITOR_ID = "studio-section-editor";
const BATCH_CHORDS_ID = "use-chords-everywhere";
const SECTION_MENU_ID = "section-more";
const TRACK_MENU_ID = "track-more";
const DELETE_CONFIRM_ID = "studio-delete-confirm";
const MOVE_FORM_ID = "studio-move-track";
const ADD_TRACK_ID = "studio-add-track";
const ADD_SECTION_ID = "studio-add-section";
const VERSION_TOGGLE_ID = "save-version-toggle";
const VERSION_FORM_ID = "studio-version-form";
const PREVIEW_CHORD_LIMIT = 128;

const AUTOSAVE_DELAY_MS = 2000;
/** Adding, deleting or moving a track saves almost at once, so the header and spine follow. */
const STRUCTURAL_SAVE_DELAY_MS = 400;
/** How long "Saved." stays after an explicit save before the relative time returns. */
const SAVED_FLASH_MS = 4000;

function resolveSelection(album: StudioAlbum, selection: SelectionInput | undefined) {
  const songs = album.songs;
  // A section id names one section wherever its track now sits: comment, task and notification
  // links keep the track number from when they were made, and tracks move.
  const sidFirst = selection?.sid?.trim();
  if (sidFirst) {
    for (let i = 0; i < songs.length; i += 1) {
      const at = (songs[i]?.sections ?? []).findIndex((s) => s.id === sidFirst);
      if (at >= 0) return { song: i, section: at };
    }
  }
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
    // Story note and Role are always in view under the track title.
    case "story":
      return { id: STORY_FOCUS_TARGETS.story, opens: null };
    case "role":
    case "position":
      return { id: STORY_FOCUS_TARGETS.role, opens: null };
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

/**
 * After the page has scrolled to show a target's surroundings (the skip link brings the
 * section's heading to the top), make sure the focused target itself can be seen below the
 * sticky layers: at 320px with 200% text the heading row alone can fill the window. Checked
 * once the scroll has settled (`scrollend`, or a timeout where no scroll happened).
 */
function revealWhenSettled(el: HTMLElement) {
  let done = false;
  let timer = 0;
  const check = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    window.removeEventListener("scrollend", check);
    const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sticky-offset")) || 0;
    const rect = el.getBoundingClientRect();
    if (visibleBelowSticky(rect, offset, window.innerHeight)) return;
    // Taller than the room under the sticky layers: its top, under them; otherwise all of it.
    const room = window.innerHeight - offset;
    el.scrollIntoView({ block: rect.height > room ? "start" : "nearest", behavior: "auto" });
  };
  window.addEventListener("scrollend", check);
  timer = window.setTimeout(check, prefersReducedMotion() ? 50 : 900);
}

/** The page's scroll padding in px (globals.css: --sticky-offset plus 1rem). */
function pageScrollPadding() {
  const root = document.documentElement;
  const padding = parseFloat(getComputedStyle(root).scrollPaddingTop);
  if (Number.isFinite(padding)) return padding;
  return parseFloat(getComputedStyle(root).getPropertyValue("--sticky-offset")) || 0;
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
  arrival = null,
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
  // The inline "Delete … and its written lyrics?" question, for the track or section it was
  // asked about (`at`: the selection it belongs to; moving elsewhere drops it).
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "track" | "section"; at: string; question: string } | null>(
    null,
  );
  // "Move to position…" open under the track header, for the track it was opened on (its id).
  const [moveFormFor, setMoveFormFor] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(() =>
    initialTarget ? arrivalFocus(initialTarget) : null,
  );
  // In one column the track list folds into "Tracks · 04 of 10 · …" (remembered for the session).
  const [tracksOpen, setTracksOpen] = useTracksOpen();
  const [storyOpen, setStoryOpen] = useState(() => initialTarget?.opens === "story");
  const [detailsOpen, setDetailsOpen] = useState(() => initialTarget?.opens === "details");
  // "Save version…" in the save bar opens its name field inline, in the bar.
  const [versionOpen, setVersionOpen] = useState(false);
  // The save bar sticks only while it and the header leave most of the window for writing.
  const [barSticks, setBarSticks] = useState(true);
  // A link to one section (`sid`, e.g. from Comments and tasks) opens its comments.
  const [commentsOpenAtStart] = useState(() => Boolean(initialSelection?.sid));
  const [navAnnouncement, setNavAnnouncement] = useState("");
  // Said once on arrival (read from the first render's props, since the URL is cleaned below)
  // and dismissed by the first edit.
  const [arrivalNote, setArrivalNote] = useState(() => arrivalText(arrival, creditsRemaining));
  // The arrival line is written into the save bar's live region after the page has mounted (a
  // region that is already filled when it appears is never announced), so it is said once.
  const [arrivalLive, setArrivalLive] = useState(false);

  const albumRef = useRef(album);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef<SaveMode | null>(null);
  // The save in flight, so leaving the Studio can wait for it before saving what's left.
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const dirtyRef = useRef(false);
  const frameKeyRef = useRef(albumFrameKey(album));
  const structuralRef = useRef(false);
  const saveRef = useRef<(mode: SaveMode) => Promise<boolean>>(async () => false);
  const stepRef = useRef<(what: "track" | "section", dir: -1 | 1) => void>(() => {});
  const moveKeyRef = useRef<(dir: -1 | 1) => void>(() => {});
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
      setPendingFocus(arrivalFocus(target));
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
  const confirmAt = `${activeSong?.id ?? ""}|${activeSection?.id ?? ""}`;
  if (confirmDelete && confirmDelete.at !== confirmAt) setConfirmDelete(null);
  if (moveFormFor && moveFormFor !== activeSong?.id) setMoveFormFor(null);

  useEffect(() => {
    albumRef.current = album;
  }, [album]);

  // The sticky stack (app header + save bar) is measured, not assumed, and published as
  // --sticky-offset on <html> while the Studio is mounted: the page's scroll padding reads it,
  // so a focused field never hides under the bar, and the track list sticks just below it. It
  // follows the bar's real height (it grows while the version field is open; Undo and Retry lie
  // over the status, so they never change it). The bar sticks only on a window at least
  // 31.3125em tall (em, so it follows the text size) and only while header + bar cover less than
  // 35% of it; otherwise it scrolls away with the page and only the header (while it sticks) is
  // counted.
  useEffect(() => {
    const bar = saveBarRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const header = bar.closest("main")?.previousElementSibling;
    const appHeader = header instanceof HTMLElement && header.tagName === "HEADER" ? header : null;
    const stuck = (el: HTMLElement) => /^(sticky|fixed)$/.test(getComputedStyle(el).position);
    const tall = window.matchMedia(STICKY_MIN_HEIGHT_QUERY);
    // The docked preview player (playerbar.tsx) is fixed to the bottom and counts toward the
    // same share. It publishes its height as the page's bottom scroll padding whenever it docks,
    // resizes or leaves, so a change to <html>'s style is when to look at it again.
    let player: Element | null = null;
    const measure = () => {
      const docked = document.getElementById("preview-player");
      if (docked !== player) {
        if (player) observer.unobserve(player);
        if (docked) observer.observe(docked);
        player = docked;
      }
      const headerHeight = appHeader && stuck(appHeader) ? appHeader.getBoundingClientRect().height : 0;
      const barHeight = bar.getBoundingClientRect().height;
      const sticks = saveBarSticks({
        tallEnough: tall.matches,
        headerHeight,
        barHeight,
        playerHeight: player ? player.getBoundingClientRect().height : 0,
        viewportHeight: window.innerHeight,
      });
      setBarSticks(sticks);
      const offset = `${Math.round(headerHeight + (sticks ? barHeight : 0))}px`;
      // Written only when it changes: the write is itself a style change the observer sees.
      if (root.style.getPropertyValue("--sticky-offset") !== offset) root.style.setProperty("--sticky-offset", offset);
    };
    const observer = new ResizeObserver(measure);
    const styleWatch = new MutationObserver(measure);
    measure();
    observer.observe(bar);
    if (appHeader) observer.observe(appHeader);
    styleWatch.observe(root, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      styleWatch.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--sticky-offset");
    };
  }, []);

  // Moves focus once the target exists: a deep-linked field, a restored row, Undo.
  useEffect(() => {
    if (!pendingFocus) return;
    const frame = requestAnimationFrame(() => {
      let el = document.getElementById(pendingFocus.id);
      // A track's row inside the folded list (one column) can't take focus: its summary can.
      if (el && pendingFocus.id.startsWith("track-row-") && !el.getClientRects().length) {
        el = document.getElementById(TRACKS_TOGGLE_ID) ?? el;
      }
      if (el) {
        el.focus({ preventScroll: true });
        // "none" keeps the page still unless the target is out of sight (e.g. Undo in the
        // save bar on a short screen, where the bar scrolls away with the page).
        const rect = el.getBoundingClientRect();
        const offScreen = rect.bottom < 0 || rect.top > window.innerHeight;
        const frameEl = pendingFocus.frame ? document.getElementById(pendingFocus.frame) : null;
        const framing =
          frameEl && pendingFocus.scroll !== "none"
            ? frameWithTarget(frameEl.getBoundingClientRect(), rect, pageScrollPadding(), window.innerHeight)
            : null;
        if (framing === "stay") {
          // The header and the lyrics are both in view already.
        } else if (framing === "frame" && frameEl) {
          // The header just under the save bar, the lyrics below it: the page's scroll padding
          // (--sticky-offset plus 1rem) places it; nothing here adds an offset of its own.
          frameEl.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
        } else if (pendingFocus.scroll !== "none" || offScreen) {
          const scrollEl = (pendingFocus.scrollTo && document.getElementById(pendingFocus.scrollTo)) || el;
          // The page's scroll padding (globals.css, from --sticky-offset) keeps it clear of
          // the header and save bar; nothing here adds its own offset.
          scrollEl.scrollIntoView({
            block: pendingFocus.scroll === "none" ? "nearest" : pendingFocus.scroll,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
          // Scrolled to the surroundings: the focused field itself must end up in view too.
          if (scrollEl !== el) revealWhenSettled(el);
        }
      }
      setPendingFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingFocus, songIndex]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // The arrival line is said once: drop `?remixed=1` from the address (keeping the rest), so a
  // reload or a shared link doesn't announce the remix again.
  useEffect(() => {
    if (!arrival) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("remixed")) return;
    url.searchParams.delete("remixed");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [arrival, router]);

  // The address follows the track and section on screen (?song=N&sid=…), so a reload, Back or a
  // copied link opens what the writer was looking at, even after a move renumbers the track.
  // History is replaced in place, not navigated: nothing re-renders from the server.
  const shownTrack = activeSong?.track_number;
  const shownSection = activeSection?.id;
  useEffect(() => {
    if (shownTrack == null) return;
    const url = new URL(window.location.href);
    const song = String(shownTrack);
    if (url.searchParams.get("song") === song && url.searchParams.get("sid") === (shownSection ?? null)) return;
    url.searchParams.set("song", song);
    if (shownSection) url.searchParams.set("sid", shownSection);
    else url.searchParams.delete("sid");
    // One-shot hints that described the arrival, not where the writer is now.
    url.searchParams.delete("section");
    url.searchParams.delete("focus");
    // `null` state, as Next.js documents: it syncs the router, so a later refresh keeps it.
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [shownTrack, shownSection]);

  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(() => setArrivalLive(true), 500);
    return () => window.clearTimeout(timer);
  }, [arrival]);

  // Leaving the Studio never drops words. An in-app link click saves first (waiting for any
  // save in flight) and then navigates; only if that save fails does the viewer choose.
  // Closing or reloading the tab still asks, and sends a last keepalive save.
  const leaveGuard = useLeaveGuard({
    when: dirty || saving,
    beforeLeave: saveBeforeLeave,
    onUnload: sendKeepaliveSave,
  });

  // Exits the link guard can't intercept (Back/Forward, a programmatic navigation) unmount
  // the Studio: send whatever is unsaved with keepalive so it survives the page going away.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) sendKeepaliveSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on unmount
  }, []);

  // Undo waits for people (WCAG 2.2.1): its 10 s clock stops while it has focus or the pointer,
  // and restarts in full when both leave. Should it lapse with focus inside, focus moves to the
  // row the change was about and the page says Undo is gone, never leaving focus on nothing.
  const undoWindow = useUndoWindow(undo?.key ?? null, (focusInside) => {
    const lapsed = undo;
    setUndo(null);
    if (!focusInside || !lapsed) return;
    setPendingFocus({ id: undoLapseFocusId(lapsed), scroll: "nearest" });
    setNavAnnouncement("Undo is no longer available.");
  });

  /** Where focus goes when Undo lapses under it: the affected track's or section's row. */
  function undoLapseFocusId(entry: UndoEntry): string {
    if (entry.kind === "track") {
      const song = songs[songIndex];
      return song?.id ? `track-row-${song.id}` : ADD_TRACK_ID;
    }
    if (entry.kind === "move") return `track-row-${entry.songId}`;
    const owner = songs.find((song) => song.id === entry.songId);
    const list = owner?.sections ?? [];
    const section = entry.kind === "chords" ? list[entry.sourceIndex] : list[Math.min(entry.index, list.length - 1)];
    return section?.id ? `section-row-${section.id}` : ADD_SECTION_ID;
  }

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(null), SAVED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  // ------------------------------------------------------------------ saving

  /** Save before leaving: wait for a save in flight, then save anything still unsaved. */
  async function saveBeforeLeave(): Promise<boolean> {
    if (inFlightRef.current) await inFlightRef.current;
    if (!dirtyRef.current) return true;
    return saveRef.current("auto");
  }

  /** A last-chance save that outlives the page (keepalive). Best effort: bodies over 64 KB
   * are refused by the browser, which is why in-app navigation saves normally first. */
  function sendKeepaliveSave() {
    const snapshot = albumRef.current;
    if (albumProblem(snapshot)) return;
    try {
      void fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album: snapshot }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // A body too large for keepalive throws synchronously; nothing more can be done here.
    }
  }

  /** Save the album. Resolves true once this album state is on the server. */
  function save(mode: SaveMode): Promise<boolean> {
    if (savingRef.current) {
      // Never two saves at once: an explicit save waits for the one in flight, then runs.
      if (mode !== "auto") queuedRef.current = mode;
      return inFlightRef.current ?? Promise.resolve(false);
    }
    const run = runSave(mode);
    inFlightRef.current = run;
    void run.finally(() => {
      if (inFlightRef.current === run) inFlightRef.current = null;
    });
    return run;
  }

  async function runSave(mode: SaveMode): Promise<boolean> {
    const snapshot = albumRef.current;
    const problem = albumProblem(snapshot);
    if (problem) {
      setSaveError(problem);
      return false;
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
      if (mode !== "auto") {
        // Saved, but honestly: chords the exports can't read are said with it.
        const unreadable = unreadableChordsOnAlbum(snapshot.songs).count;
        const saved = mode === "version" ? "Saved as a new version." : "Saved.";
        setSavedFlash(unreadable ? `${saved} ${unreadableChordsStatus(unreadable)}.` : saved);
      }
      // The album's shared frame (release header, track count, spine on the other tabs) is
      // rendered by the layout; refresh it whenever this save changed something it shows.
      const frameKey = albumFrameKey(snapshot);
      if (frameKey !== frameKeyRef.current) {
        frameKeyRef.current = frameKey;
        router.refresh();
      }
      return true;
    } catch (err) {
      const offline = err instanceof TypeError;
      setSaveError(
        offline
          ? "The server can't be reached. Your edits are still here."
          : err instanceof Error && err.message
            ? err.message
            : "Something went wrong on our side.",
      );
      return false;
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
  // between tracks, with Shift between sections; Ctrl+Alt+Shift with the same keys moves the
  // selected track one place. See studio-shortcuts.ts for the rules.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = studioShortcut(event, event.target instanceof Element ? (event.target as HTMLElement) : null);
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut.kind === "save") void saveRef.current("manual");
      else if (shortcut.kind === "move") moveKeyRef.current(shortcut.dir);
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
    setArrivalNote(null);
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
    moveKeyRef.current = moveByKey;
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
    else if (activeSong) setPendingFocus({ id: TRACK_TITLE_ID, scroll: "start", scrollTo: "studio-track" });
    else setPendingFocus({ id: EDITOR_ID, scroll: "start" });
  }

  function addTrack() {
    const index = songs.length;
    structuralRef.current = true;
    edit((prev) => ({ ...prev, songs: renumberTracks([...prev.songs, buildNewSong(prev.songs.length + 1)]) }));
    setSelection({ song: index, section: 0 });
    setPendingFocus({ id: TRACK_TITLE_ID, scroll: "nearest" });
  }

  // Deleting never moves the page: the next item is selected in place and focus goes to Undo,
  // which sits in the sticky save bar.
  function deleteTrack(index: number) {
    const song = songs[index];
    if (!song) return;
    structuralRef.current = true;
    // Renumbered, and default names ("Track 3") follow their new numbers.
    edit((prev) => ({ ...prev, songs: removeTrack(prev.songs, index) }));
    setUndo({ kind: "track", song, index, label: song.title || `Track ${song.track_number}`, key: Date.now() });
    setSelection({ song: Math.max(0, Math.min(index, songs.length - 2)), section: 0 });
    // Focus on Undo says it ("Undo, Deleted “Track 3”."): the nav line drops its old news.
    setNavAnnouncement("");
    setPendingFocus({ id: "studio-undo", scroll: "none" });
  }

  /**
   * "Delete track" from the track's More menu. A track holding written lyrics asks first, inline,
   * naming what goes; an empty or starter-only track goes at once, with Undo.
   */
  function requestDeleteTrack() {
    const song = songs[songIndex];
    if (!song) return;
    setMoveFormFor(null);
    const written = (song.sections ?? []).filter((section) => isWritten(section.lyrics)).length;
    if (!written) {
      deleteTrack(songIndex);
      return;
    }
    setConfirmDelete({ kind: "track", at: confirmAt, question: deleteTrackQuestion(song.title, song.track_number, written) });
  }

  /** "Delete section": asks first when the section's lyrics are written. */
  function requestDeleteSection() {
    const section = sections[sectionIndex];
    if (!section) return;
    if (!isWritten(section.lyrics)) {
      deleteSection(sectionIndex);
      return;
    }
    setConfirmDelete({ kind: "section", at: confirmAt, question: deleteSectionQuestion(activeLabel) });
  }

  /** The confirmed delete: as the instant one (Undo, focus to Undo) once the artist said yes. */
  function confirmDeleteNow() {
    const kind = confirmDelete?.kind;
    setConfirmDelete(null);
    if (kind === "track") deleteTrack(songIndex);
    else if (kind === "section") deleteSection(sectionIndex);
  }

  /** Cancel or Escape: nothing deleted, focus back on the "More" button that asked. */
  function cancelDelete() {
    const kind = confirmDelete?.kind;
    setConfirmDelete(null);
    setPendingFocus({ id: kind === "section" ? SECTION_MENU_ID : TRACK_MENU_ID, scroll: "none" });
  }

  function deleteConfirm(kind: "track" | "section") {
    return confirmDelete?.kind === kind ? (
      <DeleteConfirm
        id={DELETE_CONFIRM_ID}
        question={confirmDelete.question}
        onConfirm={confirmDeleteNow}
        onCancel={cancelDelete}
      />
    ) : null;
  }

  /** Adds a verse at the end of the track, selects it and puts focus in its lyrics, and says so. */
  function addSection() {
    const index = sections.length;
    const added = buildNewSection(index);
    updateSections(activeSong?.id, (list) => [...list, added]);
    setSelection({ song: songIndex, section: index });
    setPendingFocus({ id: "section-lyrics", scroll: "nearest" });
    const label = sectionLabels([...sections, added])[index] ?? "Section";
    setNavAnnouncement(`${label} added, section ${index + 1} of ${index + 1}.`);
  }

  function deleteSection(index: number) {
    const section = sections[index];
    if (!activeSong?.id || !section) return;
    updateSections(activeSong.id, (list) => list.filter((_, i) => i !== index));
    setUndo({ kind: "section", songId: activeSong.id, section, index, label: labels[index] ?? "Section", key: Date.now() });
    setSelection({ song: songIndex, section: Math.max(0, Math.min(index, sections.length - 2)) });
    setNavAnnouncement("");
    setPendingFocus({ id: "studio-undo", scroll: "none" });
  }

  function restoreDeleted() {
    if (!undo) return;
    if (undo.kind === "track") {
      const { song, index } = undo;
      structuralRef.current = true;
      edit((prev) => ({ ...prev, songs: restoreTrack(prev.songs, song, index) }));
      setSelection({ song: index, section: 0 });
      setPendingFocus({ id: `track-row-${song.id}`, scroll: "nearest" });
      setNavAnnouncement(`Put back “${undo.label}”.`);
    } else if (undo.kind === "move") {
      // Back to where the run of moves started, in one step, every name as it was then.
      const { songId, from, renamed } = undo;
      const at = songs.findIndex((s) => s.id === songId);
      if (at >= 0) {
        const to = clampIndex(from, songs.length);
        structuralRef.current = true;
        edit((prev) => ({ ...prev, songs: undoTrackMove(prev.songs, songId, from, renamed) ?? prev.songs }));
        setSelection({ song: to, section: sectionIndex });
        setNavAnnouncement(`Moved back to track ${to + 1} of ${songs.length}.`);
      }
      setPendingFocus({ id: `track-row-${songId}`, scroll: "nearest" });
    } else if (undo.kind === "section") {
      const { songId, section, index } = undo;
      const owner = songs.findIndex((s) => s.id === songId);
      updateSections(songId, (list) => {
        const next = [...list];
        next.splice(Math.min(index, next.length), 0, section);
        return next;
      });
      if (owner >= 0) setSelection({ song: owner, section: index });
      setPendingFocus({ id: `section-row-${section.id}`, scroll: "nearest" });
      setNavAnnouncement(`Put back ${undo.label}.`);
    } else {
      const { songId, previous, sourceIndex, targets } = undo;
      const owner = songs.findIndex((s) => s.id === songId);
      updateSections(songId, (list) => restoreProgressions(list, previous));
      if (owner >= 0) setSelection({ song: owner, section: sourceIndex });
      // The sections differ again, so the batch button is back: focus returns to it.
      setPendingFocus({ id: BATCH_CHORDS_ID, scroll: "nearest" });
      setNavAnnouncement(`Put the earlier chords back on ${new Intl.ListFormat("en").format(targets)}.`);
    }
    setUndo(null);
  }

  /**
   * Batch harmony: this section's chords on every other section of its type on this track, at
   * once, with a 10-second Undo in the save bar that names what changed. Focus goes to Undo
   * (the button that asked disappears, since nothing is left to apply).
   */
  function applyChordsToType() {
    const songId = activeSong?.id;
    if (!songId) return;
    const result = applyProgressionToType(sections, sectionIndex);
    if (!result) return;
    const changedLabels = result.changed.map((i) => labels[i] ?? "Section");
    updateSections(songId, () => result.sections);
    setUndo({
      kind: "chords",
      songId,
      sourceIndex: sectionIndex,
      previous: result.previous,
      targets: changedLabels,
      label: batchChordsSummary(changedLabels, chordsOf(activeSection)),
      key: Date.now(),
    });
    setPendingFocus({ id: "studio-undo", scroll: "none" });
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    const section = sections[index];
    if (!section || !moveItem(sections, index, target)) return;
    updateSections(activeSong?.id, (list) => moveItem(list, index, target) ?? list);
    setSelection({ song: songIndex, section: target });
    setNavAnnouncement(`${sectionTypeLabel(section.section_type)} moved to section ${target + 1} of ${sections.length}.`);
  }

  /**
   * Moves the track at `index` to `to` (one place or many) and renumbers the album; the moved
   * track stays selected. Said like any move: announced, and shown in the save bar with Undo.
   * Moves of the same track in a row share one Undo, which takes it back to where the first
   * started (moving it down three times, then Undo, puts it back where it was). Returns
   * whether it moved, and "back" when it is back where the run of moves started.
   */
  function moveTrackToIndex(index: number, to: number): "moved" | "back" | null {
    const song = songs[index];
    const moved = moveTrackTo(songs, index, to);
    if (!moved || !song?.id) return null;
    const songId = song.id;
    structuralRef.current = true;
    edit((prev) => ({ ...prev, songs: moveTrackTo(prev.songs, index, to) ?? prev.songs }));
    setSelection({ song: to, section: sectionIndex });
    // Named as the writer knew it: a default name follows its new number ("Track 1" becomes
    // "Track 2"), so the line says what it was called and, if that changed, what it is now.
    const before = song.title.trim() || "Untitled";
    const after = moved[to]?.title.trim() || "Untitled";
    const title = before === after ? `“${before}”` : `“${before}” (now “${after}”)`;
    setNavAnnouncement(`Moved ${title} to track ${to + 1} of ${songs.length}.`);
    // Sighted writers see the move too, where a delete is shown, with Undo: a default name
    // changes with its number, so the line says where the track came from.
    const prior = undo?.kind === "move" && undo.songId === songId ? undo : null;
    const from = prior ? prior.from : index;
    const fromTitle = prior ? prior.fromTitle : song.title;
    const renamed = mergeRenames(prior?.renamed ?? [], trackRenames(songs, moved));
    if (from === to) {
      // Moved back to where it started: nothing is left to undo.
      setUndo(null);
      return "back";
    }
    setUndo({
      kind: "move",
      songId,
      from,
      fromTitle,
      renamed,
      label: moveUndoLabel(fromTitle, moved[to]?.title ?? "", from, to),
      key: Date.now(),
    });
    return "moved";
  }

  function moveTrackBy(index: number, dir: -1 | 1) {
    moveTrackToIndex(index, index + dir);
  }

  /**
   * Ctrl+Alt+Shift+PageUp/PageDown (or ↑/↓ outside text fields): the selected track one place.
   * Focus stays where it was (a track row follows its track); at either end it says so.
   */
  function moveByKey(dir: -1 | 1) {
    const song = songs[songIndex];
    if (!song) return;
    const activeId = focusedId();
    const result = moveTrackToIndex(songIndex, songIndex + dir);
    if (!result) {
      const name = song.title.trim() || "Untitled";
      setNavAnnouncement(dir < 0 ? `“${name}” is already the first track.` : `“${name}” is already the last track.`);
      return;
    }
    // The row is re-inserted in its new place, and Undo is replaced, which can drop focus: put
    // it back (on the track's row when the Undo it was on is gone).
    const undoGone = activeId === "studio-undo" && result === "back";
    if (activeId) setPendingFocus({ id: undoGone ? `track-row-${song.id}` : activeId, scroll: "none" });
  }

  /** "Move to position…" from the track's More menu: the inline form, focus on its select. */
  function openMoveForm() {
    if (!activeSong?.id) return;
    setConfirmDelete(null);
    setMoveFormFor(activeSong.id);
  }

  /** The form's Move: one step to the chosen place, then focus back to More. */
  function moveFromForm(to: number) {
    setMoveFormFor(null);
    moveTrackToIndex(songIndex, to);
    setPendingFocus({ id: TRACK_MENU_ID, scroll: "none" });
  }

  /** Cancel or Escape: nothing moved, focus back on the "More" button that asked. */
  function cancelMoveForm() {
    setMoveFormFor(null);
    setPendingFocus({ id: TRACK_MENU_ID, scroll: "none" });
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
    setPendingFocus(lyricsArrival("nearest"));
    const label = sectionLabels(song?.sections ?? [])[upNext.section] ?? "Section";
    setNavAnnouncement(upNext.song === songIndex ? label : `Track ${song?.track_number}: ${song?.title || "Untitled"}, ${label}`);
  }

  /** Saves a named version from the save bar's inline field, then closes it (focus to its trigger). */
  async function saveVersion() {
    if (!versionMessage.trim()) return;
    const ok = await save("version");
    if (ok) closeVersion();
  }

  function openVersion() {
    setVersionOpen(true);
    setPendingFocus({ id: "version-message", scroll: "none" });
  }

  function closeVersion() {
    setVersionOpen(false);
    setPendingFocus({ id: VERSION_TOGGLE_ID, scroll: "none" });
  }

  const unreadable = useMemo(() => unreadableChordsOnAlbum(songs), [songs]);

  /** "Saved · 2 chords won't export" goes to the first chord field that has one. */
  function goToUnreadableChords() {
    const first = unreadable.first;
    if (!first) return;
    setSelection(first);
    setPendingFocus({ id: "section-chords", scroll: "center" });
    const song = songs[first.song];
    const label = sectionLabels(song?.sections ?? [])[first.section] ?? "Section";
    setNavAnnouncement(`Track ${song?.track_number}: ${song?.title || "Untitled"}, ${label}, chord progression`);
  }

  /** The first save turns comments on; focus moves from the button that goes to the thread. */
  async function saveToTurnOnComments() {
    const fromButton = focusedId() === "save-for-comments";
    const ok = await save("manual");
    if (ok && fromButton && activeSection?.id) {
      setPendingFocus({ id: `comments-${activeSection.id}-toggle`, scroll: "none" });
    }
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
    const retry = () => {
      // Retry leaves while the preview renders; hand focus back to Preview (busy, so it keeps
      // it) so a second failure can bring it to the new Retry.
      if (focusedId() === RETRY_IDS[scope]) document.getElementById(openerId)?.focus({ preventScroll: true });
      void previewFromChords(chords, subtitle, scope, openerId);
    };
    const fail = (text: string) => {
      setPreviewNote({ scope, tone: "danger", text, retry });
      // Focus follows to Retry only from the Preview button that asked: never away from a
      // field the artist went back to while it rendered.
      if (focusedId() === openerId) setPendingFocus({ id: RETRY_IDS[scope], scroll: "none" });
    };
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
    const retry = () => {
      // Retry leaves while the MP3 renders: focus goes back to the menu it came from.
      if (focusedId() === RETRY_IDS.section) document.getElementById(SECTION_MENU_ID)?.focus({ preventScroll: true });
      void downloadMp3(chords, subtitle);
    };
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
  const batchTargets = activeSection ? sameTypeTargets(sections, sectionIndex) : [];
  // Shorthand keys ("C", "Am") read as the select's own spelling, so both agree.
  const keyValue = normalizeKey(activeSong?.key) ?? "";
  const sectionType = activeSection?.section_type ?? "verse";
  const sectionTypeKnown = SECTION_TYPES.some((t) => t.value === sectionType);
  const themeColumns = Math.min(MAX_THEME_COLUMNS, (album.central_themes ?? []).filter((t) => t.trim()).length);

  // Saving has one live region, and it speaks only for events: a save the artist asked for
  // ("Saving…", then "Saved."), and a save that failed. Autosave's quiet cycle and the ticking
  // "Saved · 3 minutes ago" sit beside it, readable but never announced.
  // The remix arrival is the one exception: said once, through the live region, after mount.
  const status = saveStatusParts({ saving, mode: savingMode, error: saveError, flash: savedFlash, dirty, lastSavedAt });
  const settled = status.quiet === "saved-at" || status.quiet === "no-changes";
  const arrivalShown = Boolean(arrivalNote && settled);
  const arrivalSpoken = arrivalShown && arrivalLive && !status.live;
  const liveStatus = status.live || (arrivalSpoken ? arrivalNote : "");
  const quietStatus =
    status.quiet === "saving" ? (
      "Saving…"
    ) : status.quiet === "unsaved" ? (
      "Unsaved changes"
    ) : arrivalShown ? (
      // Until the first edit, the arrival line stands where "Saved · …" would; before the
      // page has mounted it sits here, then moves into the live region to be announced.
      arrivalSpoken ? null : <span className="text-ink">{arrivalNote}</span>
    ) : settled && unreadable.count ? (
      // Saved, but not everything will export: say so, and go to the first field that has one.
      <>
        Saved ·{" "}
        <button
          type="button"
          onClick={goToUnreadableChords}
          title="Go to the first chord the exports can't read"
          className="relative ml-1 text-left text-warn underline decoration-warn/50 underline-offset-4 after:absolute after:-inset-y-3 after:inset-x-0 after:content-[''] hover:decoration-warn"
        >
          {unreadableChordsStatus(unreadable.count)}
        </button>
      </>
    ) : status.quiet === "saved-at" && lastSavedAt ? (
      <>
        Saved · <RelativeTime date={lastSavedAt} />
      </>
    ) : status.quiet === "no-changes" ? (
      "No changes yet"
    ) : null;

  // Undo, and Retry after a failed save, lie over the save status (see the save bar).
  const retryShown = Boolean(saveError && !saving);
  const offerShown = retryShown || Boolean(undo);

  const writeNextLabel = upNext
    ? `${upNext.song === songIndex ? "" : trackPrefix(songs[upNext.song])}${
        sectionLabels(songs[upNext.song]?.sections ?? [])[upNext.section] ?? "Section"
      }`
    : "";

  const currentTrack = activeSong ? `${pad2(activeSong.track_number)} · ${activeSong.title.trim() || "Untitled"}` : null;

  // One quiet row: the current track (so a phone writer knows where they are while typing) and
  // the save status, with Undo or Retry laid over them while offered (so the bar never reflows),
  // keyboard hints (only with a fine pointer and room for them), then the actions: Help,
  // "Save version…" (its name field opens inline, below) and a ghost "Save now", as one group
  // with short visible names below 48em, and on a small screen "Write next" (the screen's one
  // primary there; from 48em it sits in the editor) on a second row of its own, so a phone's
  // bar is at most two rows.
  // Autosave does the saving; the saffron on this screen belongs to the next step of the
  // writing. The bar sticks only where it leaves most of the window for writing (see the
  // measurement above); otherwise it scrolls with the page.
  const saveBar = (
    <div
      ref={saveBarRef}
      className={cn(
        "z-20 -mx-4 border-b border-line bg-ground px-4 py-0.5 md:-mx-8 md:px-8",
        barSticks && "[@media(min-height:31.3125em)]:sticky [@media(min-height:31.3125em)]:top-header-offset",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {/* `relative`: Undo and Retry lie over this column (below), so they never reflow the bar. */}
        <div className="relative flex min-h-11 min-w-0 flex-1 basis-40 flex-col max-[48em]:basis-32 justify-center">
          {currentTrack ? (
            <p className="type-figure truncate text-sm font-semibold text-ink" title={currentTrack}>
              <span className="sr-only">Track </span>
              {currentTrack}
            </p>
          ) : null}
          {/* The live and the quiet status never both hold text, so no gap between them. */}
          <p className={cn("flex min-w-0 flex-wrap items-center text-sm", saveError ? "text-danger" : "text-ink-2")}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 flex-none animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            <span
              role="status"
              className={cn(
                "min-w-0 break-words",
                savedFlash && !saving && !saveError && "text-ok",
                arrivalSpoken && "text-ink",
              )}
            >
              {liveStatus}
            </span>
            {quietStatus ? <span className="min-w-0 break-words">{quietStatus}</span> : null}
          </p>
          {offerShown ? (
            // Undo (and Retry after a failed save) are laid over the track and status lines, in
            // the column's own box, so the bar keeps its height and nothing beside it moves when
            // one appears or lapses. The line beside them says what they are about: the failed
            // save's reason (already spoken by the status above, so hidden from it here), or
            // what Undo would put back.
            <div {...undoWindow.groupProps} className="absolute inset-0 flex min-w-0 items-center gap-x-2 bg-ground text-sm">
              <span
                id={retryShown ? undefined : "studio-undo-text"}
                className={cn("line-clamp-2 min-w-0 flex-1 break-words", retryShown ? "text-danger" : "text-ink")}
                title={retryShown ? (saveError ?? undefined) : undo ? undoText(undo) : undefined}
                aria-hidden={retryShown ? true : undefined}
              >
                {retryShown ? saveError : undo ? undoText(undo) : null}
              </span>
              {retryShown && undo ? (
                <span id="studio-undo-text" className="sr-only">
                  {undoText(undo)}
                </span>
              ) : null}
              {retryShown ? (
                <Button tone="secondary" className="flex-none" onClick={() => void save("manual")} aria-label="Retry save">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </Button>
              ) : null}
              {undo ? (
                <Button
                  id="studio-undo"
                  key={undo.key}
                  tone="secondary"
                  className="flex-none"
                  onClick={restoreDeleted}
                  aria-describedby="studio-undo-text"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Undo
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="contents pointer-coarse:hidden">
          <p className="hidden min-w-0 text-xs text-ink-3 lg:block">
            <Kbd>Ctrl/⌘ S</Kbd> save · <Kbd>Alt PgUp/PgDn</Kbd> track · with <Kbd>Shift</Kbd> section
            {/* Only where the bar has room for it on the same row (from 85rem the row holds
                the status, every hint and the actions); Help lists every shortcut. */}
            <span className="hidden min-[85rem]:inline">
              {" "}
              · <Kbd>Ctrl Alt Shift PgUp/PgDn</Kbd> move track
            </span>
          </p>
        </div>
        {/* Help, Save version and Save now stay together as one group, never one left alone on
            a row. Below 48em their names shorten to "Version" and "Save" (the full names kept
            for assistive technology), and the group sits beside the status; below 22em
            (320px, or enlarged text on a phone) only their 44px icons fit, names kept. On a
            phone (coarse pointer) below 48em, Help, which opens the keyboard shortcuts, gives
            its room to them; Help stays in the app's navigation. */}
        <div className="flex flex-none items-center gap-x-1">
          <Link
            href="/app/help#keyboard-title"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-hover hover:text-ink max-[48em]:px-2.5 max-[48em]:pointer-coarse:hidden"
          >
            <CircleHelp className="h-4 w-4 flex-none" aria-hidden="true" />
            <span className="max-[22em]:sr-only">Help</span>
            <span className="sr-only"> with the Studio and its shortcuts</span>
          </Link>
          <Button
            id={VERSION_TOGGLE_ID}
            tone="ghost"
            className="min-w-11 max-[48em]:px-2.5"
            aria-label="Save version…"
            aria-expanded={versionOpen}
            aria-controls={VERSION_FORM_ID}
            onClick={() => (versionOpen ? closeVersion() : openVersion())}
          >
            <History className="h-4 w-4 flex-none" aria-hidden="true" />
            <span className="max-[48em]:hidden">Save version…</span>
            <span aria-hidden="true" className="hidden max-[48em]:inline max-[22em]:hidden">
              Version
            </span>
          </Button>
          <Button
            tone="ghost"
            className="min-w-11 max-[48em]:px-2.5"
            onClick={() => void save("manual")}
            busy={saving}
            aria-keyshortcuts="Control+S Meta+S"
          >
            <Save className="h-4 w-4 flex-none" aria-hidden="true" />
            <span className="max-[22em]:sr-only">
              Save<span className="max-[48em]:sr-only"> now</span>
            </span>
          </Button>
        </div>
        {upNext ? (
          // Small screens only (em, so enlarged text counts as small), where the editor can be
          // a long way down the page: the one "Write next" there, and the screen's primary, on
          // the bar's second row, full width. From 48em it sits in the editor instead (below);
          // never both at once.
          <Button tone="primary" onClick={writeNext} className="basis-full min-[48em]:hidden">
            <span className="min-w-0 break-words">Write next: {writeNextLabel}</span>
            <ArrowRight className="h-4 w-4 flex-none" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {/* A named snapshot, kept in version history: an occasional act, so it opens here, in
          the bar, only when asked for. Escape closes it and focus returns to its trigger. */}
      <div
        id={VERSION_FORM_ID}
        role="group"
        aria-label="Save a version"
        hidden={!versionOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeVersion();
          }
        }}
        className="max-w-[40rem] flex-col gap-2 pb-3 pt-1 [&:not([hidden])]:flex"
      >
        <Field
          label="Version note"
          htmlFor="version-message"
          hint={<span className="block max-w-[65ch]">For example: tightened chorus, new bridge chords.</span>}
        >
          <input
            id="version-message"
            value={versionMessage}
            onChange={(e) => setVersionMessage(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveVersion();
              }
            }}
            maxLength={200}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {/* Busy while saving and unavailable without a note, but never natively disabled, so
              focus stays on it when the saved version clears the note. */}
          <Button
            tone="secondary"
            onClick={() => void saveVersion()}
            busy={saving}
            {...(versionMessage.trim() ? {} : { "aria-disabled": true })}
          >
            Save version
          </Button>
          <Button tone="ghost" onClick={closeVersion}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  /**
   * A preview's status and Retry, on their own line under the heading row that holds Preview,
   * so a long message never pushes the row's buttons around. Both scopes keep their live
   * region mounted (empty, without height) so the first message is announced.
   */
  function previewStatus(scope: PreviewNote["scope"]) {
    const note = previewNote?.scope === scope ? previewNote : null;
    return (
      <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1", note?.text && "mt-2")}>
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
          <Button id={RETRY_IDS[scope]} tone="secondary" onClick={note.retry} aria-label={note.retryLabel ?? "Retry preview"}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  // Stable handlers for the memoized parts (track list, story editor, album details): the same
  // function every render, running the latest code.
  const onSelectTrack = useStableEvent(openTrack);
  const onToggleTrackTheme = useStableEvent(toggleTrackTheme);
  const onAddTrack = useStableEvent(addTrack);
  const onAddThemes = useStableEvent(() => openAlbumField(ALBUM_THEMES_INPUT_ID));
  const onStoryChange = useStableEvent(updateSongField) as typeof updateSongField;
  const onAlbumDetailsChange = useStableEvent((patch: Partial<StudioAlbum>) => edit((prev) => ({ ...prev, ...patch })));
  const centralThemes = album.central_themes ?? NO_ITEMS;
  const albumMotifs = album.recurring_motifs ?? NO_ITEMS;

  const trackList = (
    <TrackList
      songs={songs}
      centralThemes={centralThemes}
      activeIndex={songIndex}
      onSelect={onSelectTrack}
      onToggleTheme={onToggleTrackTheme}
      onAddTrack={onAddTrack}
      onAddThemes={onAddThemes}
      open={tracksOpen}
      onOpenChange={setTracksOpen}
    />
  );

  // Whether deleting this track asks first (it holds written lyrics).
  const trackWritten = sections.some((section) => isWritten(section.lyrics));

  const catalog = activeSong
    ? [
        `${sections.length} ${sections.length === 1 ? "section" : "sections"}`,
        `${progress.written} written`,
        activeSong.key || null,
        activeSong.tempo ? `${activeSong.tempo} bpm` : null,
      ].filter((part): part is string => Boolean(part))
    : [];

  // Other tracks with this title (trimmed, any casing), named under the title field.
  const sharedTitle = useMemo(() => tracksSharingTitle(songs, songIndex), [songs, songIndex]);

  const trackHeader = activeSong ? (
    <section id="studio-track" aria-labelledby="studio-song-title" className="flex min-w-0 flex-col gap-4">
      <div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        {/* The heading is the track's title, edited in place (TrackTitle): renaming happens
            where the name is read. Named "Track 01: Storm Warning" once, set outright. It
            takes the row's room; Preview song and More wrap below it when there is none. */}
        <div className="min-w-0 flex-1 basis-64">
          <TrackTitle
            headingId="studio-song-title"
            trackNumber={activeSong.track_number}
            title={activeSong.title ?? ""}
            sharedWith={sharedTitle}
            onChange={(title) => updateSongField("title", title)}
          />
          {/* The release header's rule: each separator ends the item before it, so a wrapped
              line never starts with a dot. */}
          <p className="type-catalog type-figure mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-2">
            <CatalogItems items={catalog} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button id="preview-song" tone="secondary" onClick={previewSong} busy={previewing}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Preview song
          </Button>
          <MoreMenu
            label="track actions"
            triggerId={TRACK_MENU_ID}
            items={[
              {
                key: "up",
                label: "Move track up",
                icon: <ArrowUp className="h-4 w-4" aria-hidden="true" />,
                disabled: songIndex === 0,
                keyshortcuts: MOVE_TRACK_UP_KEYSHORTCUTS,
                onSelect: () => moveTrackBy(songIndex, -1),
              },
              {
                key: "down",
                label: "Move track down",
                icon: <ArrowDown className="h-4 w-4" aria-hidden="true" />,
                disabled: songIndex >= songs.length - 1,
                keyshortcuts: MOVE_TRACK_DOWN_KEYSHORTCUTS,
                onSelect: () => moveTrackBy(songIndex, 1),
              },
              {
                key: "position",
                label: "Move to position…",
                hint: "Any place in the sequence, in one step.",
                icon: <ArrowUpDown className="h-4 w-4" aria-hidden="true" />,
                disabled: songs.length < 2,
                onSelect: openMoveForm,
              },
              {
                key: "delete",
                label: "Delete track",
                hint: trackWritten
                  ? "Removes the track and its sections. Asks first, since it has written lyrics; you can undo for 10 seconds."
                  : "Removes the track and its sections. You can undo for 10 seconds.",
                icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                danger: true,
                onSelect: requestDeleteTrack,
              },
            ]}
          />
        </div>
      </div>
      {previewStatus("track")}
      {deleteConfirm("track")}
      {moveFormFor === activeSong.id ? (
        <MoveTrackForm
          id={MOVE_FORM_ID}
          songs={songs}
          current={songIndex}
          onMove={moveFromForm}
          onCancel={cancelMoveForm}
        />
      ) : null}
      </div>

      {/* The track's Role and Story note, always in view: Coherence asks every track for them. */}
      <SongStoryFields song={activeSong} onChange={updateSongField} />
      {/* Where the track list has no theme columns (a phone, enlarged text), this track's
          album themes are toggled here instead. */}
      <TrackThemeToggles
        className="@5xl/studio:hidden"
        song={activeSong}
        centralThemes={album.central_themes ?? []}
        onToggle={(theme) => toggleTrackTheme(songIndex, theme)}
      />
    </section>
  ) : null;

  // The track's key and tempo: set once and rarely changed, so they follow the writing rather
  // than stand between the track's title and its lyrics (the catalog line under the title
  // already shows them). The title is edited in the track's heading.
  const trackDetails = activeSong ? (
    <section aria-labelledby="studio-track-details-title" className="border-t border-line pt-5">
      <h2 id="studio-track-details-title" className="text-lg font-semibold text-ink">
        Track details
      </h2>
      {/* Key and Tempo share a row only while each column holds the longest key whole
          ("G# minor" needs 6.5rem, in rem so enlarged text needs more room); narrower (390px
          with 200% text) they stack, so the select never reads "C m". */}
      <div className="mt-4 grid max-w-[36rem] grid-cols-1 gap-4 @min-[14.5rem]:grid-cols-2">
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

  // "Sections" heads the list's own column, and Add section follows the list, so the heading
  // shares a row with the current section's heading and the lyrics start one row sooner.
  const sectionsHeading = (
    <h2 id="studio-sections-title" className="flex min-h-11 items-center text-lg font-semibold text-ink">
      Sections
    </h2>
  );
  const sectionEditor = activeSong ? (
    <section aria-labelledby="studio-sections-title" className="border-t border-line pt-5">
      {sections.length ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 @xl:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3 self-start">
            {sectionsHeading}
            <ol aria-label={`Sections of ${songTitle}`} className="border-t border-line">
              {sections.map((section, index) => {
                const isActive = index === sectionIndex;
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
                          {sectionChordSummary(sections, index)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Button id={ADD_SECTION_ID} tone="secondary" className="self-start" onClick={addSection}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add section
            </Button>
          </div>

          {activeSection ? (
            <div id={SECTION_EDITOR_ID} className="flex min-w-0 flex-col gap-4">
              <div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <h3 className="text-base font-semibold text-ink">{activeLabel}</h3>
                    <p className="type-figure text-xs text-ink-3">
                      {sectionIndex + 1} of {sections.length}
                    </p>
                    {/* In one column the track list is far above the lyrics (a phone): a way
                        back to it, landing on this track's row. Beside the editor it's in view. */}
                    <a
                      href={`#track-row-${activeSong.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        // The list may be folded here (one column): open it on this track.
                        setTracksOpen(true);
                        setPendingFocus({ id: `track-row-${activeSong.id}`, scroll: "center" });
                      }}
                      className="-mx-1 inline-flex min-h-11 items-center gap-1 self-center rounded px-1 text-xs text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink @2xl/studio:hidden"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">Back to </span>Tracks
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button id="preview-section" tone="secondary" onClick={previewSection} busy={previewing}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Preview section
                  </Button>
                  <MoreMenu
                    label="section actions"
                    triggerId={SECTION_MENU_ID}
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
                        hint: isWritten(activeSection.lyrics)
                          ? "Asks first, since its lyrics are written. You can undo for 10 seconds."
                          : "You can undo for 10 seconds.",
                        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                        danger: true,
                        onSelect: requestDeleteSection,
                      },
                    ]}
                  />
                </div>
              </div>
              {previewStatus("section")}
              {deleteConfirm("section")}
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
                  starterLoop={isStarterLoopSection(sections, sectionIndex)}
                />
              </div>
              {batchTargets.length ? (
                // Batch harmony: reuse this progression across the track's sections of this
                // type, with an Undo in the save bar. The hint names what it will change.
                <div className="-mt-1 flex flex-wrap items-center gap-x-3">
                  <Button
                    id={BATCH_CHORDS_ID}
                    tone="ghost"
                    className="-ml-2 px-2"
                    onClick={applyChordsToType}
                    aria-describedby="use-chords-everywhere-hint"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Use these chords on every {sectionTypeLabel(activeSection.section_type)}
                  </Button>
                  <p id="use-chords-everywhere-hint" className="min-w-0 max-w-[65ch] text-xs text-ink-3">
                    Changes {new Intl.ListFormat("en").format(batchTargets.map((i) => labels[i] ?? "Section"))} on
                    this track. You can undo for 10 seconds.
                  </p>
                </div>
              ) : null}
              {upNext ? (
                // From 48em only: below it, the save bar carries the one "Write next".
                <div className="max-[48em]:hidden">
                  <Button tone="primary" onClick={writeNext}>
                    Write next: {writeNextLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}

              {stableIdsPersisted && activeSection.id ? (
                <SectionCommentsMemo
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
                    <Button id="save-for-comments" tone="ghost" onClick={() => void saveToTurnOnComments()} busy={saving}>
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
        <>
          {sectionsHeading}
          <div className="mt-3">
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
          </div>
        </>
      )}
    </section>
  ) : null;

  const storyAndAi = activeSong ? (
    <div className="flex min-w-0 flex-col gap-6">
      <SongStoryEditor
        key={`story-${activeSong.id}`}
        song={activeSong}
        albumThemes={centralThemes}
        albumMotifs={albumMotifs}
        onChange={onStoryChange}
        open={storyOpen}
        onOpenChange={setStoryOpen}
      />
      <SongDevelopmentAiMemo
        key={`ai-${activeSong.id}`}
        albumId={albumId}
        songTitle={songTitle}
        trackNumber={activeSong.track_number}
        aiAvailable={aiAvailable}
        creditsRemaining={creditsRemaining}
      />
    </div>
  ) : null;

  return (
    <div className="@container/studio-top flex min-w-0 flex-col gap-4">
      {/* The first stop inside the album content: past the save bar and the whole track list,
          straight to the current section's lyrics. In one column (a phone, enlarged text: the
          same 42rem at which the track list folds) the lyrics are screens down, so it is a
          visible link, an ink link like any other, that a touch can take; with the columns
          side by side it is visible on focus only, like the app's skip link. */}
      {songs.length ? (
        <a
          href={`#${EDITOR_ID}`}
          onClick={(event) => {
            event.preventDefault();
            skipToLyrics();
          }}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 self-start rounded text-sm text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink",
            "@min-[42rem]/studio-top:sr-only @min-[42rem]/studio-top:z-50 @min-[42rem]/studio-top:bg-accent @min-[42rem]/studio-top:font-semibold @min-[42rem]/studio-top:text-accent-ink @min-[42rem]/studio-top:no-underline",
            "@min-[42rem]/studio-top:focus:not-sr-only @min-[42rem]/studio-top:focus:fixed @min-[42rem]/studio-top:focus:left-4 @min-[42rem]/studio-top:focus:top-4 @min-[42rem]/studio-top:focus:px-4 @min-[42rem]/studio-top:focus:py-3",
          )}
        >
          <ArrowDown className="h-4 w-4 shrink-0 text-ink-3 @min-[42rem]/studio-top:hidden" aria-hidden="true" />
          Skip to the lyrics
        </a>
      ) : null}
      {saveBar}
      <LeavePrompt
        guard={{
          ...leaveGuard,
          // "Leave without saving" means it: no last keepalive save on the way out.
          leaveAnyway: () => {
            dirtyRef.current = false;
            leaveGuard.leaveAnyway();
          },
        }}
        message={`Your latest changes couldn't be saved${saveError ? `: ${saveError.replace(/[.\s]+$/, "")}` : ""}. Stay to retry, or leave without them.`}
      />
      <p className="sr-only" aria-live="polite">
        {navAnnouncement}
      </p>
      {/* The columns follow the room the Studio has (rem container queries), so enlarged text
          folds it to one column. Fields keep clear of the sticky header and save bar through
          the page's scroll padding alone (globals.css reads --sticky-offset, set above). */}
      <div className="@container/studio min-w-0">
      <div
        className={cn(
          "grid min-w-0 grid-cols-1 items-start gap-x-8 gap-y-8",
          STUDIO_GRID_BASE,
          STUDIO_GRID_COLUMNS[themeColumns],
        )}
      >
        {trackList}

        <div id={EDITOR_ID} className="@container flex min-w-0 flex-col gap-6">
          {songs.length ? (
            <>
              {trackHeader}
              {sectionEditor}
              {trackDetails}
              {storyAndAi}
            </>
          ) : (
            <EmptyState
              title="Start the record with its first track"
              action={
                <Button id={ADD_TRACK_ID} tone="secondary" onClick={addTrack}>
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
            onChange={onAlbumDetailsChange}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

export function AlbumStudio(props: AlbumStudioProps) {
  return useAlbumStudioRender(props);
}
