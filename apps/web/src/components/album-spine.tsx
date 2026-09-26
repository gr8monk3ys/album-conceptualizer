import Link from "next/link";
import { Check } from "lucide-react";

import type { SpineRow } from "@/server/album-songs";
import { ThemeMark } from "@/components/theme-mark";
import { TableScroller } from "@/components/ui";
import { carriedThemesPhrase, themeAbbreviations, themeHeadClasses } from "@/lib/theme-keys";
import { cn } from "@/lib/utils";

/**
 * "1/2", "2/2", "—": Sections with lyrics out of all Sections, as tabular figures, so the
 * column lines up down the sequence (never a "½" glyph, which sets narrower than "2/2").
 */
export function lyricFraction(written: number, total: number) {
  if (!total) return { visible: "—", spoken: "No sections yet" };
  return {
    visible: `${written}/${total}`,
    spoken: `Lyrics: ${written} of ${total} ${total === 1 ? "section" : "sections"} written`,
  };
}

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

/**
 * The album's sequence as a track sheet: track number, title, lyrics written, which album
 * themes the track carries (one mark per theme) and whether it has a role in the arc. Every
 * row opens that track in the Studio.
 *
 * Names, not codes: wherever the spine's own container has room, each theme column is headed
 * by the theme's name in catalog caps, in a 3rem slot, truncated with the full name on hover
 * and in the head's accessible name (`themeHeadClasses`: 15rem plus 3rem a theme, so the side
 * column shows names for up to four themes on a laptop and the Sequence disclosure for all
 * six). Only the narrowest column falls back to short keys, spelled out in a legend under the
 * table that the table names as its description.
 *
 * Built to survive enlarged text: the table sizes itself to its content (never `table-fixed`),
 * the title keeps at least 8rem, and when that no longer fits the table scrolls sideways
 * inside its own region (with an edge fade on the side that has more) rather than squeezing
 * the title to a letter per line. The number, lyrics, theme (1rem a key) and role columns are
 * kept narrow enough that three themes and the 8rem title fit a 320px phone at normal text
 * size (the table was 4px wider than the phone's column, clipping "Role"). A screen reader
 * hears each row once: title, lyrics, one phrase for the themes, role.
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
  const heads = themeHeadClasses(themes.length);
  const legendId = `${idPrefix}-theme-keys`;
  const showLegend = rows.length > 0 && themes.length > 0;

  const body = rows.length ? (
    <TableScroller label="Tracks in sequence">
      <table className="w-full border-collapse text-sm" aria-describedby={showLegend ? legendId : undefined}>
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
            <th scope="col" className="type-catalog w-8 px-0.5 pb-2 text-center text-xs font-semibold text-ink-3">
              Lyrics
            </th>
            {themes.length ? (
              <th scope="col" className="pb-2 font-semibold">
                {/* The head's accessible name carries every theme in full, whatever the visible
                    head can fit. */}
                <span className="sr-only">Album themes: {themes.join(", ")}</span>
                {/* One head per theme, read left to right like the marks beneath it: the name
                    where the container has room, a short key (spelled out below) where not. */}
                <span aria-hidden="true" className="flex items-end justify-center">
                  {themes.map((theme, index) => (
                    <span key={theme} title={theme} className={cn("block w-4 min-w-0 shrink-0 text-center", heads.slot)}>
                      <abbr title={theme} className={cn("type-catalog block text-xs text-ink-3 no-underline", heads.keys)}>
                        {abbreviations[index]}
                      </abbr>
                      <span className={cn("type-catalog truncate px-0.5 text-xs text-ink-3", heads.names)}>{theme}</span>
                    </span>
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
                    "type-figure px-0.5 text-center align-middle text-sm",
                    complete ? "text-ink" : row.lyricSections ? "text-ink-2" : "text-ink-3",
                  )}
                >
                  <span aria-hidden="true">{lyrics.visible}</span>
                  <span className="sr-only">{lyrics.spoken}</span>
                </td>
                {themes.length ? (
                  <td className="align-middle">
                    <span aria-hidden="true" className="flex justify-center">
                      {themes.map((theme, index) => (
                        <span key={theme} className={cn("grid w-4 shrink-0 place-items-center", heads.slot)}>
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
    </TableScroller>
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
    // A size container: the theme heads choose names or keys by the room the spine has.
    <section
      aria-labelledby={heading ? `${idPrefix}-title` : undefined}
      aria-label={heading ? undefined : "Sequence"}
      className="@container"
    >
      {heading ? (
        <h2 id={`${idPrefix}-title`} className="mb-2 text-sm font-semibold text-ink">
          Sequence
        </h2>
      ) : null}
      {body}
      {showLegend ? (
        // The key for the theme columns, shown only while they show keys, and named by the
        // table as its description. Screen readers hear each theme by name in the table, so
        // the legend itself isn't read a second time in the page's flow.
        <p
          id={legendId}
          aria-hidden="true"
          className={cn("mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-ink-3", heads.legend)}
        >
          <span className="sr-only">Theme keys: </span>
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
