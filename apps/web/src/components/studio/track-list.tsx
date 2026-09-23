"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";

import { carriedThemes, type StudioSong } from "@/components/studio/studio-model";
import { TRACK_KEYSHORTCUTS } from "@/components/studio/studio-shortcuts";
import { ThemeMark } from "@/components/theme-mark";
import { Button, TableScroller } from "@/components/ui";
import { lyricProgress } from "@/lib/lyrics";
import { carriedThemesPhrase, themeAbbreviations } from "@/lib/theme-keys";
import { cn } from "@/lib/utils";

/** The album's central themes shown as columns; more than this reads as noise. */
export const MAX_THEME_COLUMNS = 6;

const FRACTION_GLYPHS: Record<string, string> = { "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾" };

/** "½", "2/2", "0/3"; "—" when the track has no sections yet. */
export function lyricFraction({ written, total }: { written: number; total: number }) {
  if (!total) return "—";
  const plain = `${written}/${total}`;
  return FRACTION_GLYPHS[plain] ?? plain;
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

const HEAD = "type-catalog sticky top-0 z-20 bg-ground px-1 pb-1.5 pt-2 align-bottom text-xs font-medium text-ink-3";

type Cut = { above: number; below: number };

/**
 * The album spine, editable: every track in sequence with its lyric progress, which of the
 * album's central themes it carries, and its role. Selecting a row opens that track in the
 * editor; with room for the theme columns, each cell is a toggle that tags or untags the track,
 * so the whole album can be tagged from here. In one column (phones, enlarged text) every
 * track is in the page flow; beside the editor the list sticks and scrolls on its own, and
 * says how many rows are out of view.
 */
export function TrackList({
  songs,
  centralThemes,
  activeIndex,
  onSelect,
  onToggleTheme,
  onAddTrack,
  onAddThemes,
}: {
  songs: StudioSong[];
  centralThemes: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onToggleTheme: (index: number, theme: string) => void;
  onAddTrack: () => void;
  onAddThemes: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [cut, setCut] = useState<Cut>({ above: 0, below: 0 });
  // The theme matrix is one tab stop; arrow keys move within it (a roving tabindex).
  const [rove, setRove] = useState({ row: 0, col: 0 });
  const themes = centralThemes.filter((t) => t.trim()).slice(0, MAX_THEME_COLUMNS);
  const hiddenThemes = centralThemes.filter((t) => t.trim()).length - themes.length;
  // Short horizontal keys head the theme columns (spelled out in a legend), as in the spine.
  const abbreviations = themeAbbreviations(themes);
  const activeId = songs[activeIndex]?.id;
  const roveRow = Math.min(rove.row, Math.max(0, songs.length - 1));
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
      className={cn(
        "flex min-w-0 flex-col",
        "[@media(min-height:501px)]:@2xl:sticky [@media(min-height:501px)]:@2xl:top-[var(--sticky-offset,var(--header-h))] [@media(min-height:501px)]:@2xl:max-h-[calc(100dvh_-_var(--sticky-offset,var(--header-h))_-_1rem)] @2xl:self-start",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="studio-tracks-title" className="text-lg font-semibold text-ink">
          Tracks
        </h2>
        <Button tone="ghost" onClick={onAddTrack}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add track
        </Button>
      </div>

      {songs.length ? (
        // A focusable, labelled region (so it scrolls from the keyboard) that scrolls sideways
        // when enlarged text leaves no room, and on its own beside the editor.
        <TableScroller
          ref={scrollRef}
          label="Track list"
          className="mt-1 min-h-0 border-b border-line focus-visible:-outline-offset-2 [@media(min-height:501px)]:@2xl:flex-1 [@media(min-height:501px)]:@2xl:overflow-y-auto"
        >
          <table className="w-full border-collapse text-left">
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
                {themes.length ? (
                  <th scope="col" className={cn(HEAD, "w-px text-right @5xl:hidden")}>
                    Themes
                  </th>
                ) : null}
                {themes.map((theme, col) => (
                  <th key={theme} scope="col" className={cn(HEAD, "hidden w-px px-0 text-center @5xl:table-cell")}>
                    <abbr title={theme} aria-hidden="true" className="no-underline">
                      {abbreviations[col]}
                    </abbr>
                    <span className="sr-only">{theme}</span>
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
                        className={cn(
                          "flex min-h-11 w-full min-w-32 flex-col justify-center text-left after:absolute after:inset-0 after:content-['']",
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
                      </button>
                    </th>
                    <td className="type-figure px-1 text-right align-middle text-sm text-ink-2">
                      <span aria-hidden="true">{lyricFraction(progress)}</span>
                      <span className="sr-only">{lyricSentence(progress)}</span>
                    </td>
                    {themes.length ? (
                      <td className="type-figure px-1 text-right align-middle text-sm text-ink-2 @5xl:hidden">
                        <span aria-hidden="true">
                          {carried.length}/{themes.length}
                        </span>
                        <span className="sr-only">{carriedThemesPhrase(carried, themes.length)}</span>
                      </td>
                    ) : null}
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
                            onFocus={() => setRove({ row: index, col })}
                            onKeyDown={(e) => onMatrixKeyDown(e, index, col)}
                            onClick={() => onToggleTheme(index, theme)}
                            // Above the row's stretched select box. A tagged cell gets a
                            // transparent border that forced colors draw, where the filled
                            // square's background is dropped.
                            className={cn(
                              "relative z-10 mx-auto grid h-11 w-11 place-items-center rounded-sm border transition-colors hover:bg-hover",
                              carries ? "border-transparent" : "border-transparent forced-colors:border-[color:Canvas]",
                            )}
                          >
                            <ThemeMark carries={carries} label="" />
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
        // The key to the theme columns; the column heads carry the full names for screen readers.
        <p aria-hidden="true" className="mt-2 hidden max-w-[65ch] flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 @5xl:flex">
          {themes.map((theme, col) => (
            <span key={theme} className="min-w-0 break-words">
              <span className="type-catalog text-ink-3">{abbreviations[col]}</span> {theme}
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
    </section>
  );
}

function songIndexSafe(index: number, length: number) {
  return length <= 0 ? 0 : Math.min(length - 1, Math.max(0, index));
}
