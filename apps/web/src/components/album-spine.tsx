import Link from "next/link";
import { Check } from "lucide-react";

import type { SpineRow } from "@/server/album-songs";
import { ThemeMark } from "@/components/theme-mark";
import { carriedThemesPhrase, themeAbbreviations } from "@/lib/theme-keys";
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
 * The album's sequence as a track sheet: track number, title, lyrics written, which album
 * themes the track carries (one mark per theme, under a short key spelled out in a legend)
 * and whether it has a role in the arc. Every row opens that track in the Studio.
 *
 * Built to survive enlarged text: the table sizes itself to its content (never `table-fixed`),
 * the title keeps at least 8rem, and when that no longer fits the table scrolls sideways
 * inside its own region rather than squeezing the title to a letter per line. A screen
 * reader hears each row once: title, lyrics, one phrase for the themes, role.
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
  const abbreviations = themeAbbreviations(themes);

  const body = rows.length ? (
    <div className="relative min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Tracks in sequence: lyrics written, the album themes each track carries, and whether it
          has a role in the arc. Select a title to open the track in the Studio.
        </caption>
        <thead>
          <tr className="border-b border-line align-bottom">
            <th scope="col" className="type-catalog w-6 pb-2 pr-1 text-left text-xs font-semibold text-ink-3">
              <span aria-hidden="true">#</span>
              <span className="sr-only">Track number</span>
            </th>
            <th scope="col" className="type-catalog pb-2 pr-2 text-left text-xs font-semibold text-ink-3">
              Title
            </th>
            <th scope="col" className="type-catalog w-8 px-1 pb-2 text-center text-xs font-semibold text-ink-3">
              Lyrics
            </th>
            {themes.length ? (
              <th scope="col" className="px-0.5 pb-2 font-semibold">
                <span className="sr-only">Album themes</span>
                {/* One short key per theme, read left to right like the marks beneath it. */}
                <span aria-hidden="true" className="flex justify-center">
                  {themes.map((theme, index) => (
                    <abbr
                      key={theme}
                      title={theme}
                      className="type-catalog block w-4.5 shrink-0 text-center text-xs text-ink-3 no-underline"
                    >
                      {abbreviations[index]}
                    </abbr>
                  ))}
                </span>
              </th>
            ) : null}
            <th scope="col" className="type-catalog w-8 pb-2 pl-1 text-center text-xs font-semibold text-ink-3">
              Role
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lyrics = lyricFraction(row.lyricSections, row.sections);
            const complete = row.sections > 0 && row.lyricSections === row.sections;
            const carried = themes.filter((_, index) => row.themeKeys.includes(themeKeys[index]));
            return (
              <tr
                key={row.trackNumber}
                className="relative border-b border-line transition-colors hover:bg-hover has-[a:focus-visible]:bg-hover"
              >
                <td className="type-figure h-11 py-1.5 pr-1 align-middle text-sm font-semibold text-ink-3">
                  {pad(row.trackNumber)}
                </td>
                <td className="py-1.5 pr-2 align-middle">
                  {/* The link covers the whole row, so any cell is a 44px target. The title
                      keeps a readable width however large the text gets. */}
                  <Link
                    href={`${base}/studio?song=${row.trackNumber}`}
                    title={row.title}
                    className="line-clamp-2 min-w-[8rem] break-words text-sm text-ink hyphens-auto after:absolute after:inset-0"
                  >
                    {row.title}
                  </Link>
                </td>
                <td
                  className={cn(
                    "type-figure px-1 text-center align-middle text-sm",
                    complete ? "text-ink" : row.lyricSections ? "text-ink-2" : "text-ink-3",
                  )}
                >
                  <span aria-hidden="true">{lyrics.visible}</span>
                  <span className="sr-only">{lyrics.spoken}</span>
                </td>
                {themes.length ? (
                  <td className="px-0.5 align-middle">
                    <span aria-hidden="true" className="flex justify-center">
                      {themes.map((theme, index) => (
                        <span key={theme} className="grid w-4.5 shrink-0 place-items-center">
                          <ThemeMark carries={row.themeKeys.includes(themeKeys[index])} />
                        </span>
                      ))}
                    </span>
                    {/* One phrase per row instead of one "doesn't carry" per cell. */}
                    <span className="sr-only">{carriedThemesPhrase(carried, themes.length)}</span>
                  </td>
                ) : null}
                <td className="pl-1 text-center align-middle" title={row.narrativePosition ?? undefined}>
                  {row.narrativePosition ? (
                    <Check className="mx-auto h-4 w-4 text-ink-2" aria-hidden="true" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="mx-auto block h-1 w-1 rounded-full bg-line-strong forced-colors:bg-[GrayText]"
                    />
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
    </div>
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
      {rows.length && themes.length ? (
        // The key for the theme columns. Screen readers already hear each theme by name.
        <p aria-hidden="true" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-ink-3">
          {themes.map((theme, index) => (
            <span key={theme} className="min-w-0 break-words">
              <span className="type-catalog text-ink-2">{abbreviations[index]}</span> {theme}
            </span>
          ))}
        </p>
      ) : null}
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
