"use client";

import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, Plus } from "lucide-react";

import { carriedThemes, type StudioSong } from "@/components/studio/studio-model";
import { TRACK_KEYSHORTCUTS } from "@/components/studio/studio-shortcuts";
import { TRACKS_TOGGLE_ID, tracksSummary } from "@/components/studio/tracks-disclosure";
import { sameKeys } from "@/components/studio/use-stable-event";
import { ThemeHeadName } from "@/components/theme-mark";
import { Button, TableScroller } from "@/components/ui";
import { lyricProgress } from "@/lib/lyrics";
import { carriedThemesPhrase, themeAbbreviations } from "@/lib/theme-keys";
import { cn } from "@/lib/utils";

/** The album's central themes shown as columns; more than this reads as noise. */
export const MAX_THEME_COLUMNS = 6;

/**
 * "1/2", "2/2", "0/3" in tabular figures, so the column aligns (never a "½" glyph, which sets
 * narrower than its neighbours); "—" when the track has no sections yet.
 */
export function lyricFraction({ written, total }: { written: number; total: number }) {
  if (!total) return "—";
  return `${written}/${total}`;
}

/**
 * The Studio's theme toggle face: the theme's key letter in a small square, filled Bone Ink
 * with the letter in the ground colour when the track carries the theme, the bare letter in
 * Ash Ink when it doesn't. The spine keeps ThemeMark's square and dot; the Studio matrix is
 * where tagging happens, so each toggle shows which theme it is without a tooltip. Forced
 * colors draw it in system colours (CanvasText fill, Canvas letter; GrayText when off).
 */
function ThemeToggleFace({ carries, letter }: { carries: boolean; letter: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "type-catalog grid h-6 min-w-6 place-items-center rounded-sm px-0.5 text-xs leading-none forced-color-adjust-none",
        carries
          ? "bg-ink font-semibold text-ground forced-colors:bg-[CanvasText] forced-colors:text-[Canvas]"
          : "text-ink-3 forced-colors:text-[GrayText]",
      )}
    >
      {letter}
    </span>
  );
}

function lyricSentence({ written, total }: { written: number; total: number }) {
  if (!total) return "No sections yet";
  return `${written} of ${total} ${total === 1 ? "section" : "sections"} written`;
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * The Studio's two columns, keyed to the room the Studio actually has (container queries in
 * rem, so enlarged text folds the layout to one column instead of squeezing it): the track
 * list beside the editor from 42rem, one 44px toggle column per central theme from 64rem,
 * and the Role column from 80rem. Literal strings so Tailwind sees them; index = theme count.
 */
export const STUDIO_GRID_BASE = "@2xl:grid-cols-[17rem_minmax(0,1fr)]";
export const STUDIO_GRID_COLUMNS = [
  "@7xl:grid-cols-[25rem_minmax(0,1fr)]",
  "@7xl:grid-cols-[25rem_minmax(0,1fr)]",
  "@5xl:grid-cols-[19.5rem_minmax(0,1fr)] @7xl:grid-cols-[27.5rem_minmax(0,1fr)]",
  "@5xl:grid-cols-[22.25rem_minmax(0,1fr)] @7xl:grid-cols-[30.25rem_minmax(0,1fr)]",
  "@5xl:grid-cols-[25rem_minmax(0,1fr)] @7xl:grid-cols-[33rem_minmax(0,1fr)]",
  "@5xl:grid-cols-[27.75rem_minmax(0,1fr)] @7xl:grid-cols-[35.75rem_minmax(0,1fr)]",
  "@5xl:grid-cols-[30.5rem_minmax(0,1fr)] @7xl:grid-cols-[38.5rem_minmax(0,1fr)]",
] as const;

const BODY_ID = "studio-track-list";

const HEAD = "type-catalog sticky top-0 z-20 bg-ground px-1 pb-1.5 pt-2 align-bottom text-xs font-medium text-ink-3";

type Cut = { above: number; below: number };

type TrackListProps = {
  songs: StudioSong[];
  centralThemes: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onToggleTheme: (index: number, theme: string) => void;
  onAddTrack: () => void;
  onAddThemes: () => void;
  /** In one column: whether the folded list is open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Whether the list would draw a track the same: what a row shows (number, title, role, themes,
 * lyric progress). Typing lyrics replaces the track's object on every keystroke, but its row
 * changes only when a section turns written or back.
 */
export function sameTrackRow(prev: StudioSong | undefined, next: StudioSong | undefined): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;
  if (!sameKeys(prev, next, ["id", "track_number", "title", "narrative_position", "themes"])) return false;
  if (prev.sections === next.sections) return true;
  const a = lyricProgress(prev.sections);
  const b = lyricProgress(next.sections);
  return a.written === b.written && a.total === b.total;
}

/** TrackList's memo test: its own props by identity, the tracks by what their rows show. */
export function sameTrackListProps(prev: TrackListProps, next: TrackListProps): boolean {
  if (
    !sameKeys(prev, next, [
      "centralThemes",
      "activeIndex",
      "onSelect",
      "onToggleTheme",
      "onAddTrack",
      "onAddThemes",
      "open",
      "onOpenChange",
    ])
  ) {
    return false;
  }
  if (prev.songs === next.songs) return true;
  return prev.songs.length === next.songs.length && prev.songs.every((song, i) => sameTrackRow(song, next.songs[i]));
}

/**
 * The album spine, editable: every track in sequence with its lyric progress, which of the
 * album's central themes it carries, and its role. Selecting a row opens that track in the
 * editor; with room for the theme columns, each cell is a toggle that tags or untags the track,
 * so the whole album can be tagged from here. In one column (phones, enlarged text) every
 * track is in the page flow; beside the editor the list sticks and scrolls on its own, and
 * says how many rows are out of view.
 *
 * In one column the list folds into a disclosure ("Tracks · 04 of 10 · Track 4", `open` /
 * `onOpenChange`, remembered by the Studio for the session), so the current track's editor
 * follows straight after it instead of screens further down. Beside the editor it is always open.
 *
 * Memoized: every keystroke in the editor re-renders the Studio, and the list (a row and a
 * toggle per theme for every track) is its largest part. Callers pass stable callbacks.
 */
export const TrackList = memo(TrackListView, sameTrackListProps);

function TrackListView({
  songs,
  centralThemes,
  activeIndex,
  onSelect,
  onToggleTheme,
  onAddTrack,
  onAddThemes,
  open,
  onOpenChange,
}: TrackListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [cut, setCut] = useState<Cut>({ above: 0, below: 0 });
  // The theme matrix is one tab stop; arrow keys move within it (a roving tabindex).
  const [rove, setRove] = useState({ row: 0, col: 0 });
  // The theme column whose toggle has keyboard focus, picked out in the legend.
  const [focusedTheme, setFocusedTheme] = useState<number | null>(null);
  const themes = centralThemes.filter((t) => t.trim()).slice(0, MAX_THEME_COLUMNS);
  const hiddenThemes = centralThemes.filter((t) => t.trim()).length - themes.length;
  // Each toggle shows its theme's short key (the first letters of the name over its column).
  const abbreviations = themeAbbreviations(themes);
  const activeId = songs[activeIndex]?.id;
  const roveRow = Math.min(rove.row, Math.max(0, songs.length - 1));
  const activeSafe = songIndexSafe(activeIndex, songs.length);
  // Only a list with tracks folds; an empty one says so in the open.
  const folds = songs.length > 0;
  const roveCol = Math.min(rove.col, Math.max(0, themes.length - 1));

  // Keep the current track in view inside the list without moving the page.
  useEffect(() => {
    const box = scrollRef.current;
    const row = activeId ? box?.querySelector<HTMLElement>(`[data-track-row="${activeId}"]`) : null;
    if (!box || !row || box.scrollHeight <= box.clientHeight + 1) return;
    // Rects, not offsetTop: the row is positioned, so its offsetParent is not the list.
    const head = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const boxRect = box.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.top - boxRect.top + box.scrollTop - head;
    const bottom = rowRect.bottom - boxRect.top + box.scrollTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [activeId]);

  // Beside the editor the list scrolls on its own under its sticky column heads. A row reached
  // by Tab or Shift+Tab is scrolled into view by the browser, which keeps it clear of those
  // heads only if the scroller's scroll padding says how tall they are: measured, since theme
  // names can take two lines and text can be enlarged.
  const hasRows = songs.length > 0;
  useEffect(() => {
    const box = scrollRef.current;
    const head = box?.querySelector("thead");
    if (!box || !head) return;
    const pad = () => {
      box.style.scrollPaddingTop = `${Math.ceil(head.getBoundingClientRect().height)}px`;
    };
    const observer = new ResizeObserver(pad);
    observer.observe(head);
    return () => {
      observer.disconnect();
      box.style.removeProperty("scroll-padding-top");
    };
  }, [hasRows]);

  // How many rows the side column's own scroll hides above and below ("3 more below").
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const measure = () => {
      let above = 0;
      let below = 0;
      if (box.scrollHeight > box.clientHeight + 1) {
        const rect = box.getBoundingClientRect();
        const headBottom = box.querySelector("thead")?.getBoundingClientRect().bottom ?? rect.top;
        box.querySelectorAll<HTMLElement>("[data-track-row]").forEach((row) => {
          const r = row.getBoundingClientRect();
          const middle = r.top + r.height / 2;
          if (middle < headBottom) above += 1;
          else if (middle > rect.bottom) below += 1;
        });
      }
      setCut((prev) => (prev.above === above && prev.below === below ? prev : { above, below }));
    };
    // A ResizeObserver reports once as soon as it starts observing, which gives the first measure.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    const table = box.querySelector("table");
    if (table) observer.observe(table);
    box.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      box.removeEventListener("scroll", measure);
    };
  }, [songs.length]);

  function focusCell(row: number, col: number) {
    const r = Math.max(0, Math.min(songs.length - 1, row));
    const c = Math.max(0, Math.min(themes.length - 1, col));
    setRove({ row: r, col: c });
    document.getElementById(`theme-toggle-${r}-${c}`)?.focus();
  }

  function onMatrixKeyDown(event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const moves: Record<string, [number, number]> = {
      ArrowRight: [row, col + 1],
      ArrowLeft: [row, col - 1],
      ArrowDown: [row + 1, col],
      ArrowUp: [row - 1, col],
      Home: [row, 0],
      End: [row, themes.length - 1],
    };
    const to = moves[event.key];
    if (!to) return;
    event.preventDefault();
    focusCell(to[0], to[1]);
  }

  const cueParts = [
    cut.above ? `${cut.above} more above` : null,
    cut.below ? `${cut.below} more below` : null,
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="studio-tracks-title"
      // Beside the editor the list sticks under the header and save bar (their measured
      // height, set by the Studio as --sticky-offset), except on short screens, where a
      // sticky column would leave no room to write.
      // The breakpoint is in em, so it follows the reader's text size.
      className={cn(
        "flex min-w-0 flex-col",
        "[@media(min-height:31.3125em)]:@2xl:sticky [@media(min-height:31.3125em)]:@2xl:top-[var(--sticky-offset,var(--header-h))] [@media(min-height:31.3125em)]:@2xl:max-h-[calc(100dvh_-_var(--sticky-offset,var(--header-h))_-_1rem)] @2xl:self-start",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Folded, the heading takes the row: a shrink-to-fit heading let the button's max-width
            resolve against its own content and wrapped "Track 1" onto a second line. */}
        <h2 id="studio-tracks-title" className={cn("min-w-0 text-lg font-semibold text-ink", folds && "flex-1 @2xl:flex-none")}>
          {folds ? (
            // One column only: the heading is the disclosure's button, naming where you are.
            <button
              id={TRACKS_TOGGLE_ID}
              type="button"
              aria-expanded={open}
              aria-controls={BODY_ID}
              onClick={() => onOpenChange(!open)}
              className="-ml-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded px-2 text-left transition-colors hover:bg-hover @2xl:hidden"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 flex-none text-ink-2 transition-transform motion-reduce:transition-none",
                  open && "rotate-90",
                )}
              />
              <span className="type-figure min-w-0 break-words">{tracksSummary(songs[activeSafe], songs.length)}</span>
            </button>
          ) : null}
          <span className={cn(folds && "hidden @2xl:inline")}>Tracks</span>
        </h2>
        {/* Folded, the list's own actions fold with it; the editor offers Add track too. */}
        <Button tone="ghost" onClick={onAddTrack} className={cn(folds && !open && "@max-2xl:hidden")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add track
        </Button>
      </div>

      {/* `contents` beside the editor, so the scroller still fills the sticky column. */}
      <div id={BODY_ID} className={cn("flex min-w-0 flex-col @2xl:contents", folds && !open && "@max-2xl:hidden")}>

      {songs.length ? (
        // A focusable, labelled region (so it scrolls from the keyboard) that scrolls sideways
        // when enlarged text leaves no room, and on its own beside the editor.
        <TableScroller
          ref={scrollRef}
          label="Track list"
          className="mt-1 min-h-0 border-b border-line focus-visible:-outline-offset-2 [@media(min-height:31.3125em)]:@2xl:flex-1 [@media(min-height:31.3125em)]:@2xl:overflow-y-auto"
        >
          <table
            className="w-full border-collapse text-left"
            aria-describedby={themes.length ? "theme-legend" : undefined}
          >
            <caption className="sr-only">
              Tracks in order, with lyrics written, the central themes each carries and its role.
              Choose a track to edit it.
              {themes.length ? " Theme buttons tag or untag a track with that theme." : ""}
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={cn(HEAD, "w-px pl-1")}>
                  <span aria-hidden="true">#</span>
                  <span className="sr-only">Track number</span>
                </th>
                <th scope="col" className={HEAD}>
                  Title
                </th>
                <th scope="col" className={cn(HEAD, "w-px text-right")}>
                  Lyrics
                </th>
                {themes.map((theme) => (
                  // The theme's whole name over its 44px column, on two lines when one won't
                  // hold it (`ThemeHeadName`: 2.75rem less padding); only a name two lines can't
                  // hold truncates. The full name is the header's accessible name, its tooltip,
                  // and in the legend below, where the theme under keyboard focus is picked out.
                  <th key={theme} scope="col" className={cn(HEAD, "hidden w-11 px-0 text-center @5xl:table-cell")}>
                    <span className="sr-only">{theme}</span>
                    <ThemeHeadName theme={theme} widthRem={2.5} className="mx-auto block w-11 px-0.5" />
                  </th>
                ))}
                <th scope="col" className={cn(HEAD, "hidden w-32 pl-3 @7xl:table-cell")}>
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song, index) => {
                const isActive = index === songIndexSafe(activeIndex, songs.length);
                const progress = lyricProgress(song.sections);
                const carried = carriedThemes(song.themes, themes);
                const carriedKeys = new Set(carried.map((t) => t.trim().toLowerCase()));
                const position = song.narrative_position?.trim() ?? "";
                const title = song.title?.trim() || "Untitled";
                return (
                  <tr
                    key={song.id ?? `${song.track_number}-${song.title}`}
                    data-track-row={song.id}
                    className={cn(
                      "relative border-b border-line transition-colors last:border-b-0",
                      isActive ? "bg-selected" : "hover:bg-hover",
                    )}
                  >
                    <td className="py-1.5 pl-1 pr-2 align-middle">
                      <span
                        className={cn(
                          "type-figure text-xl font-semibold",
                          isActive ? "text-accent" : "text-ink-3",
                        )}
                      >
                        {pad2(song.track_number)}
                      </span>
                    </td>
                    <th scope="row" className="px-1 py-1 text-left align-middle font-normal">
                      {/* The button's box stretches over the whole row, so any cell selects it.
                          The current row's box also carries a transparent frame that forced
                          colors (High Contrast) draw in Highlight, since its fill and saffron
                          number vanish there. */}
                      <button
                        id={`track-row-${song.id}`}
                        type="button"
                        onClick={() => onSelect(index)}
                        aria-current={isActive ? "true" : undefined}
                        aria-keyshortcuts={TRACK_KEYSHORTCUTS}
                        aria-describedby={themes.length ? `track-themes-${index}` : undefined}
                        className={cn(
                          // The ring is drawn inset: the scroller would clip it at the row's edge.
                          "flex min-h-11 w-full min-w-32 flex-col justify-center text-left focus-visible:-outline-offset-2 after:absolute after:inset-0 after:content-['']",
                          isActive &&
                            "after:border-2 after:border-transparent forced-colors:after:border-[color:Highlight]",
                        )}
                      >
                        <span className="line-clamp-2 break-words text-sm font-semibold text-ink hyphens-auto" title={title}>
                          {title}
                        </span>
                        {position ? (
                          <span className="line-clamp-2 break-words text-xs text-ink-2 @7xl:hidden">{position}</span>
                        ) : null}
                        {themes.length ? (
                          // Without the theme columns, the names of the themes it carries, as text.
                          <span aria-hidden="true" className="type-catalog break-words text-xs text-ink-2 @5xl:hidden">
                            {carried.length ? carried.join(" · ") : <span className="text-ink-3">No album themes</span>}
                          </span>
                        ) : null}
                      </button>
                      {themes.length ? (
                        <span id={`track-themes-${index}`} className="sr-only">
                          {carriedThemesPhrase(carried, themes.length)}
                        </span>
                      ) : null}
                    </th>
                    <td className="type-figure px-1 text-right align-middle text-sm text-ink-2">
                      <span aria-hidden="true">{lyricFraction(progress)}</span>
                      <span className="sr-only">{lyricSentence(progress)}</span>
                    </td>
                    {themes.map((theme, col) => {
                      const carries = carriedKeys.has(theme.trim().toLowerCase());
                      const tabbable = index === roveRow && col === roveCol;
                      return (
                        <td key={theme} className="hidden p-0 text-center align-middle @5xl:table-cell">
                          <button
                            id={`theme-toggle-${index}-${col}`}
                            type="button"
                            aria-pressed={carries}
                            aria-label={`Tag track ${song.track_number} with ${theme}`}
                            title={`${carries ? "Untag" : "Tag"} track ${song.track_number}: ${theme}`}
                            tabIndex={tabbable ? 0 : -1}
                            aria-describedby={tabbable ? "theme-matrix-hint" : undefined}
                            onFocus={() => {
                              setRove({ row: index, col });
                              setFocusedTheme(col);
                            }}
                            onBlur={() => setFocusedTheme(null)}
                            onKeyDown={(e) => onMatrixKeyDown(e, index, col)}
                            onClick={() => onToggleTheme(index, theme)}
                            // Above the row's stretched select box. A tagged cell gets a
                            // transparent border that forced colors draw, where the filled
                            // square's background is dropped.
                            className={cn(
                              "relative z-10 mx-auto grid h-11 w-11 place-items-center rounded-sm border transition-colors hover:bg-hover focus-visible:-outline-offset-2",
                              carries ? "border-transparent" : "border-transparent forced-colors:border-[color:Canvas]",
                            )}
                          >
                            <ThemeToggleFace carries={carries} letter={abbreviations[col] ?? ""} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="hidden pl-3 pr-1 align-middle text-xs text-ink-2 @7xl:table-cell">
                      {position ? (
                        <span className="line-clamp-2 break-words" title={position}>
                          {position}
                        </span>
                      ) : (
                        <>
                          <span aria-hidden="true" className="text-ink-3">
                            —
                          </span>
                          <span className="sr-only">No role</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {themes.length ? (
            <span id="theme-matrix-hint" className="sr-only">
              Arrow keys move between tracks and themes.
            </span>
          ) : null}
        </TableScroller>
      ) : (
        <p className="mt-2 max-w-[65ch] text-sm text-ink-2">No tracks yet.</p>
      )}

      {themes.length ? (
        // The theme columns spelled out in full, left to right, tied to the table as its
        // description. While a theme toggle has focus, its theme is picked out here, so the
        // full name is on screen for keyboard users too (a tooltip only follows the pointer).
        <p id="theme-legend" className="mt-2 hidden max-w-[65ch] flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 @5xl:flex">
          <span className="sr-only">Album themes, in column order: </span>
          {themes.map((theme, col) => (
            <span
              key={theme}
              className={cn(
                "min-w-0 break-words",
                focusedTheme === col && "font-semibold text-ink underline decoration-line-strong underline-offset-4",
              )}
            >
              <span aria-hidden="true" className="type-catalog text-ink-3">
                {abbreviations[col]}
              </span>{" "}
              {theme}
              {col < themes.length - 1 ? <span className="sr-only">,</span> : null}
            </span>
          ))}
        </p>
      ) : null}

      {cueParts.length ? (
        // A visual cue only: the table itself holds every track for assistive technology.
        <p aria-hidden="true" className="type-figure mt-1 text-xs text-ink-3">
          {cueParts.join(" · ")}
        </p>
      ) : null}

      {songs.length && !themes.length ? (
        <div className="mt-2 flex flex-col items-start gap-1">
          <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
            Add the album’s central themes to see which tracks carry each one.
          </p>
          <Button tone="ghost" className="-ml-2 px-2" onClick={onAddThemes}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add central themes
          </Button>
        </div>
      ) : hiddenThemes > 0 ? (
        <p className="mt-2 max-w-[65ch] text-xs leading-relaxed text-ink-3">
          Showing the first {MAX_THEME_COLUMNS} central themes; {hiddenThemes} more{" "}
          {hiddenThemes === 1 ? "is" : "are"} in Album details.
        </p>
      ) : null}
      </div>
    </section>
  );
}

/**
 * The current track's album themes as a row of toggles, for layouts where the track list has
 * no theme columns (a phone, enlarged text): each theme by its name, pressed when the track
 * carries it. Pressed is a filled Bone Ink chip with Ground lettering (CanvasText/Canvas in
 * forced colors); unpressed, an outline chip.
 */
export function TrackThemeToggles({
  song,
  centralThemes,
  onToggle,
  className,
}: {
  song: StudioSong;
  centralThemes: string[];
  onToggle: (theme: string) => void;
  className?: string;
}) {
  const themes = centralThemes.filter((t) => t.trim()).slice(0, MAX_THEME_COLUMNS);
  if (!themes.length) return null;
  const carried = new Set(carriedThemes(song.themes, themes).map((t) => t.trim().toLowerCase()));
  const labelId = `track-theme-toggles-${song.id ?? song.track_number}`;
  return (
    <div role="group" aria-labelledby={labelId} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <p id={labelId} className="text-sm font-medium text-ink">
        Album themes on this track
      </p>
      <div className="flex min-w-0 flex-wrap gap-2">
        {themes.map((theme) => {
          const carries = carried.has(theme.trim().toLowerCase());
          return (
            <button
              key={theme}
              type="button"
              aria-pressed={carries}
              onClick={() => onToggle(theme)}
              className={cn(
                "type-catalog inline-flex min-h-11 min-w-11 max-w-full items-center justify-center break-words rounded border px-3 text-xs transition-colors forced-color-adjust-none",
                carries
                  ? "border-ink bg-ink font-semibold text-ground forced-colors:border-[color:CanvasText] forced-colors:bg-[CanvasText] forced-colors:text-[Canvas]"
                  : "border-line-strong text-ink-2 hover:bg-hover hover:text-ink forced-colors:border-[color:GrayText] forced-colors:text-[CanvasText]",
              )}
            >
              {theme}
            </button>
          );
        })}
      </div>
      <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
        Pressed means this track carries the theme; the coherence report checks each track for them.
      </p>
    </div>
  );
}

function songIndexSafe(index: number, length: number) {
  return length <= 0 ? 0 : Math.min(length - 1, Math.max(0, index));
}
