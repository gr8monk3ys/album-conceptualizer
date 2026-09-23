import Link from "next/link";
import { Check } from "lucide-react";

import type { SpineRow } from "@/server/album-songs";
import { ThemeMark } from "@/components/theme-mark";
import { cn } from "@/lib/utils";

const FRACTION_GLYPHS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
};

/** "½", "2/2", "—": sections with lyrics out of all sections, as a figure that fits a column. */
function lyricFraction(written: number, total: number) {
  if (!total) return { visible: "—", spoken: "No sections yet" };
  const key = `${written}/${total}`;
  return {
    visible: FRACTION_GLYPHS[key] ?? key,
    spoken: `Lyrics: ${written} of ${total} ${total === 1 ? "section" : "sections"} written`,
  };
}

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

/**
 * The album's sequence as a grid: track number, title, lyrics written, one narrow column per
 * album theme (a mark where the track carries it) and whether the track has a role in the arc.
 * Every row opens that track in the Studio.
 */
export function AlbumSpine({
  albumId,
  rows,
  themes,
  heading = true,
  idPrefix = "album-spine",
}: {
  albumId: string;
  rows: SpineRow[];
  /** The album's central themes, at most six, in the order the artist set them. */
  themes: string[];
  /** The side column shows a "Sequence" heading; the compact disclosure has its own summary. */
  heading?: boolean;
  idPrefix?: string;
}) {
  const base = `/app/albums/${albumId}`;
  const themeKeys = themes.map((theme) => theme.toLowerCase());

  const body = rows.length ? (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">
        Tracks in sequence: lyrics written, the album themes each track carries, and whether it
        has a role in the arc. Select a title to open the track in the Studio.
      </caption>
      <colgroup>
        <col className="w-7" />
        <col />
        <col className="w-10" />
        {themes.map((theme) => (
          <col key={theme} className="w-4" />
        ))}
        <col className="w-9" />
      </colgroup>
      <thead>
        <tr className="border-b border-line align-bottom">
          <th scope="col" className="type-catalog pb-2 text-left text-xs font-semibold text-ink-3">
            <span aria-hidden="true">#</span>
            <span className="sr-only">Track number</span>
          </th>
          <th scope="col" className="type-catalog pb-2 text-left text-xs font-semibold text-ink-3">
            Title
          </th>
          <th scope="col" className="type-catalog pb-2 text-center text-xs font-semibold text-ink-3">
            Lyrics
          </th>
          {themes.map((theme) => (
            <th key={theme} scope="col" title={theme} className="h-24 p-0 pb-2 align-bottom font-semibold">
              {/* Vertical, so six theme names fit over six narrow columns; the full name is read out. */}
              <span className="type-catalog mx-auto block max-h-24 rotate-180 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-3 [writing-mode:vertical-rl]">
                {theme}
              </span>
            </th>
          ))}
          <th scope="col" className="type-catalog pb-2 text-center text-xs font-semibold text-ink-3">
            Role
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const lyrics = lyricFraction(row.lyricSections, row.sections);
          const complete = row.sections > 0 && row.lyricSections === row.sections;
          return (
            <tr
              key={row.trackNumber}
              className="relative border-b border-line transition-colors hover:bg-hover has-[a:focus-visible]:bg-hover"
            >
              <td className="type-figure h-11 py-1.5 pr-1 align-middle text-sm font-semibold text-ink-3">
                {pad(row.trackNumber)}
              </td>
              <td className="py-1.5 pr-2 align-middle">
                {/* The link covers the whole row, so any cell is a 44px target. */}
                <Link
                  href={`${base}/studio?song=${row.trackNumber}`}
                  title={row.title}
                  className="line-clamp-2 break-words text-sm text-ink after:absolute after:inset-0"
                >
                  {row.title}
                </Link>
              </td>
              <td
                className={cn(
                  "type-figure text-center align-middle text-sm",
                  complete ? "text-ink" : row.lyricSections ? "text-ink-2" : "text-ink-3",
                )}
              >
                <span aria-hidden="true">{lyrics.visible}</span>
                <span className="sr-only">{lyrics.spoken}</span>
              </td>
              {themes.map((theme, index) => {
                const carries = row.themeKeys.includes(themeKeys[index]);
                return (
                  <td key={theme} className="p-0 text-center align-middle">
                    <ThemeMark
                      carries={carries}
                      label={carries ? `carries ${theme}` : `doesn't carry ${theme}`}
                    />
                  </td>
                );
              })}
              <td className="text-center align-middle" title={row.narrativePosition ?? undefined}>
                {row.narrativePosition ? (
                  <Check className="mx-auto h-4 w-4 text-ink-2" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true" className="mx-auto block h-1 w-1 rounded-full bg-line-strong" />
                )}
                <span className="sr-only">
                  {row.narrativePosition ? `Role: ${row.narrativePosition}` : "No role yet"}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : (
    <p className="max-w-[65ch] text-sm text-ink-2">
      No tracks yet.{" "}
      <Link href={`${base}/studio`} className="font-semibold text-ink underline decoration-line-strong underline-offset-4">
        Add the first one in the Studio
      </Link>
      .
    </p>
  );

  return (
    <section aria-labelledby={heading ? `${idPrefix}-title` : undefined} aria-label={heading ? undefined : "Sequence"}>
      {heading ? (
        <h2 id={`${idPrefix}-title`} className="mb-2 text-sm font-semibold text-ink">
          Sequence
        </h2>
      ) : null}
      {body}
      {rows.length && !themes.length ? (
        <p className="mt-3 max-w-[65ch] text-xs leading-relaxed text-ink-3">
          Name the album&apos;s themes to see which tracks carry them.{" "}
          <Link href={`${base}/studio?focus=album`} className="text-ink-2 underline decoration-line-strong underline-offset-4">
            Add album themes
          </Link>
        </p>
      ) : null}
    </section>
  );
}
