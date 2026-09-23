"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Plus } from "lucide-react";

import type { StudioSong } from "@/components/studio/studio-model";
import { ThemeMark } from "@/components/theme-mark";
import { Button } from "@/components/ui";
import { lyricProgress } from "@/lib/lyrics";
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
 * The grid columns of the Studio layout, sized to the track list: one narrow column per
 * central theme from xl, the narrative position from 2xl. Literal strings so Tailwind sees them.
 */
export const STUDIO_GRID_COLUMNS = [
  "xl:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[23rem_minmax(0,1fr)]",
  "xl:grid-cols-[17.5rem_minmax(0,1fr)] 2xl:grid-cols-[24.5rem_minmax(0,1fr)]",
  "xl:grid-cols-[19rem_minmax(0,1fr)] 2xl:grid-cols-[26rem_minmax(0,1fr)]",
  "xl:grid-cols-[20.5rem_minmax(0,1fr)] 2xl:grid-cols-[27.5rem_minmax(0,1fr)]",
  "xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[29rem_minmax(0,1fr)]",
  "xl:grid-cols-[23.5rem_minmax(0,1fr)] 2xl:grid-cols-[30.5rem_minmax(0,1fr)]",
  "xl:grid-cols-[25rem_minmax(0,1fr)] 2xl:grid-cols-[32rem_minmax(0,1fr)]",
] as const;

const HEAD = "type-catalog sticky top-0 z-10 bg-ground px-1 pb-1.5 pt-2 align-bottom text-xs font-medium text-ink-3";

/**
 * The album spine, editable: every track in sequence with its lyric progress, which of the
 * album's central themes it carries, and its narrative position. Selecting a row opens that
 * track in the editor. Sticky beside the editor on large screens; a compact list above it on
 * small ones.
 */
export function TrackList({
  songs,
  centralThemes,
  activeIndex,
  onSelect,
  onAddTrack,
  onAddThemes,
  style,
}: {
  songs: StudioSong[];
  centralThemes: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAddTrack: () => void;
  onAddThemes: () => void;
  style?: CSSProperties;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const themes = centralThemes.filter((t) => t.trim()).slice(0, MAX_THEME_COLUMNS);
  const hiddenThemes = centralThemes.filter((t) => t.trim()).length - themes.length;
  const activeId = songs[activeIndex]?.id;

  // Keep the current track in view inside the list without moving the page.
  useEffect(() => {
    const box = scrollRef.current;
    const row = activeId ? box?.querySelector<HTMLElement>(`[data-track-row="${activeId}"]`) : null;
    if (!box || !row) return;
    // Rects, not offsetTop: the row is positioned, so its offsetParent is not the list.
    const head = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const boxRect = box.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.top - boxRect.top + box.scrollTop - head;
    const bottom = rowRect.bottom - boxRect.top + box.scrollTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [activeId]);

  return (
    <section
      aria-labelledby="studio-tracks-title"
      className="flex min-w-0 flex-col lg:sticky lg:self-start"
      style={style}
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
        <div ref={scrollRef} className="mt-1 max-h-64 min-h-0 overflow-y-auto border-b border-line lg:max-h-none lg:flex-1">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Tracks in order, with lyrics written, the central themes each carries and its narrative
              position. Choose a track to edit it.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={cn(HEAD, "w-10 pl-1")}>
                  <span aria-hidden="true">#</span>
                  <span className="sr-only">Track number</span>
                </th>
                <th scope="col" className={HEAD}>
                  Title
                </th>
                <th scope="col" className={cn(HEAD, "w-14 text-right")}>
                  Lyrics
                </th>
                {themes.length ? (
                  <th scope="col" className={cn(HEAD, "w-16 text-right xl:hidden")}>
                    Themes
                  </th>
                ) : null}
                {themes.map((theme) => (
                  <th key={theme} scope="col" title={theme} className={cn(HEAD, "hidden w-6 xl:table-cell")}>
                    <span className="mx-auto block max-h-24 rotate-180 truncate [writing-mode:vertical-rl]">
                      {theme}
                    </span>
                  </th>
                ))}
                <th scope="col" className={cn(HEAD, "hidden w-28 pl-3 2xl:table-cell")}>
                  Position
                </th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song, index) => {
                const isActive = index === songIndexSafe(activeIndex, songs.length);
                const progress = lyricProgress(song.sections);
                const carried = new Set((song.themes ?? []).map((t) => t.trim().toLowerCase()));
                const carriedCount = themes.filter((t) => carried.has(t.trim().toLowerCase())).length;
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
                    <td className="py-1.5 pl-1 align-middle">
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
                      {/* The button's box stretches over the whole row, so any cell selects it. */}
                      <button
                        id={`track-row-${song.id}`}
                        type="button"
                        onClick={() => onSelect(index)}
                        aria-current={isActive ? "true" : undefined}
                        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                        className="flex min-h-11 w-full min-w-0 flex-col justify-center text-left after:absolute after:inset-0 after:content-['']"
                      >
                        <span className="block w-full truncate text-sm font-semibold text-ink" title={title}>
                          {title}
                        </span>
                        {position ? (
                          <span className="block w-full truncate text-xs text-ink-2 2xl:hidden">{position}</span>
                        ) : null}
                      </button>
                    </th>
                    <td className="type-figure px-1 text-right align-middle text-sm text-ink-2">
                      <span aria-hidden="true">{lyricFraction(progress)}</span>
                      <span className="sr-only">{lyricSentence(progress)}</span>
                    </td>
                    {themes.length ? (
                      <td className="type-figure px-1 text-right align-middle text-sm text-ink-2 xl:hidden">
                        <span aria-hidden="true">
                          {carriedCount}/{themes.length}
                        </span>
                        <span className="sr-only">
                          Carries {carriedCount} of {themes.length} central themes
                        </span>
                      </td>
                    ) : null}
                    {themes.map((theme) => {
                      const carries = carried.has(theme.trim().toLowerCase());
                      return (
                        <td key={theme} className="hidden text-center align-middle xl:table-cell">
                          <ThemeMark
                            carries={carries}
                            label={carries ? `carries ${theme}` : `doesn't carry ${theme}`}
                          />
                        </td>
                      );
                    })}
                    <td className="hidden truncate pl-3 pr-1 align-middle text-xs text-ink-2 2xl:table-cell" title={position || undefined}>
                      {position || (
                        <>
                          <span aria-hidden="true" className="text-ink-3">
                            —
                          </span>
                          <span className="sr-only">No narrative position</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 max-w-[65ch] text-sm text-ink-2">No tracks yet.</p>
      )}

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
