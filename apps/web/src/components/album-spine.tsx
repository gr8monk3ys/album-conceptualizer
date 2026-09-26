import Link from "next/link";
import { Check } from "lucide-react";

import type { SpineRow } from "@/server/album-songs";
import { ThemeHeadName, ThemeMark } from "@/components/theme-mark";
import { TableScroller } from "@/components/ui";
import {
  THEME_NAME_SLOT_REM,
  carriedThemesPhrase,
  themeAbbreviations,
  themeHeadClasses,
  themeHeadLines,
  type ThemeHeadClasses,
} from "@/lib/theme-keys";
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

export type SpineHeads = ThemeHeadClasses & {
  /** The room a theme's name has inside its slot (the slot less its padding), in rem. */
  nameRem: number;
};

/** The album spine's theme heads: 3rem slots (less 0.25rem padding), `themeHeadClasses`. */
function albumSpineHeads(count: number): SpineHeads {
  return { ...themeHeadClasses(count), nameRem: THEME_NAME_SLOT_REM - 0.25 };
}

/**
 * The track sheet itself, shared by the album's own spine and the read-only one (Discover, the
 * setup preview): track number, title, lyrics written, one ThemeMark per album theme under the
 * theme's head, and whether the track has a role in the arc. `rowHref` says where a title
 * links (stretched over the whole 44px row), or null for plain text.
 *
 * Names, not codes: wherever the container (an `@container` ancestor) has room, each theme
 * column is headed by the theme's whole name in catalog caps, on two lines when one won't hold
 * it (`ThemeHeadName`); `heads` picks the width at which names replace keys. Only a name that
 * not even two lines hold truncates, and then the legend under the table names every theme in
 * full, as it does whenever the narrowest layouts show short keys instead. The table names the
 * legend as its description.
 *
 * Built to survive enlarged text: the table sizes itself to its content (never `table-fixed`),
 * the title keeps at least 8rem, and when that no longer fits the table scrolls sideways
 * inside its own region (with an edge fade on the side that has more) rather than squeezing
 * the title to a letter per line. The number, lyrics, theme (1rem a key) and role columns are
 * kept narrow enough that three themes and the 8rem title fit a 320px phone at normal text
 * size. A screen reader hears each row once: title, lyrics, one phrase for the themes, role.
 */
export function SpineSheet({
  rows,
  themes,
  heads,
  rowHref,
  caption,
  legendId,
}: {
  rows: SpineRow[];
  /** The album's central themes, at most six, in the order the artist set them. */
  themes: string[];
  heads: SpineHeads;
  rowHref: (trackNumber: number) => string | null;
  caption: string;
  legendId: string;
}) {
  const themeKeys = themes.map((theme) => theme.toLowerCase());
  const abbreviations = themeAbbreviations(themes);
  const showLegend = rows.length > 0 && themes.length > 0;
  // A name two lines can't hold truncates in its head, so the legend stays up to name it.
  const namesTruncate = themes.some((theme) => themeHeadLines(theme, heads.nameRem).truncated);

  return (
    <>
      <TableScroller label="Tracks in sequence">
        <table className="w-full border-collapse text-sm" aria-describedby={showLegend ? legendId : undefined}>
          <caption className="sr-only">{caption}</caption>
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
                  {/* The head's accessible name carries every theme in full, whatever the
                      visible head can fit. */}
                  <span className="sr-only">Album themes: {themes.join(", ")}</span>
                  {/* One head per theme, read left to right like the marks beneath it: the whole
                      name where the container has room, a short key (spelled out below) where
                      not. */}
                  <span aria-hidden="true" className="flex items-end justify-center">
                    {themes.map((theme, index) => (
                      <span key={theme} className={cn("block w-4 min-w-0 shrink-0 text-center", heads.slot)}>
                        <abbr title={theme} className={cn("type-catalog block text-xs text-ink-3 no-underline", heads.keys)}>
                          {abbreviations[index]}
                        </abbr>
                        <ThemeHeadName theme={theme} widthRem={heads.nameRem} className={cn("px-0.5", heads.names)} />
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
              const href = rowHref(row.trackNumber);
              return (
                <tr
                  key={row.trackNumber}
                  className={cn(
                    "border-b border-line",
                    href && "relative transition-colors hover:bg-hover has-[a:focus-visible]:bg-hover",
                  )}
                >
                  {/* The number names the row, so focusing its title scrolls the number into
                      view with it rather than under the start fade (TableScroller). */}
                  <td
                    data-keep-in-view=""
                    className="type-figure h-11 py-1.5 pr-1 align-middle text-sm font-semibold text-ink-3"
                  >
                    {pad(row.trackNumber)}
                  </td>
                  <td className="py-1.5 pr-2 align-middle">
                    {href ? (
                      // The link covers the whole row, so any cell is a 44px target. The title
                      // keeps a readable width however large the text gets.
                      <Link
                        href={href}
                        title={row.title}
                        className="line-clamp-2 min-w-[8rem] break-words text-sm text-ink hyphens-auto after:absolute after:inset-0"
                      >
                        {row.title}
                      </Link>
                    ) : (
                      <span className="line-clamp-2 min-w-[8rem] break-words text-sm text-ink hyphens-auto">
                        {row.title}
                      </span>
                    )}
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
      {showLegend ? (
        // The themes in full, left to right: always while the heads show keys ("M memory"), and
        // while they show names if one of them had to truncate ("Themes: memory, …"). Named by
        // the table as its description; screen readers hear each theme by name in the table,
        // so the legend itself isn't read a second time in the page's flow.
        <p
          id={legendId}
          aria-hidden="true"
          className={cn(
            "mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-ink-3",
            namesTruncate ? null : heads.legend,
          )}
        >
          <span className="sr-only">Album themes: </span>
          {namesTruncate ? <span className={cn("type-catalog", heads.names)}>Themes</span> : null}
          {themes.map((theme, index) => (
            <span key={theme} className="min-w-0 break-words">
              <span className={cn("type-catalog text-ink-2", heads.keys)}>{abbreviations[index]} </span>
              <span className={namesTruncate ? "text-ink-2" : undefined}>{theme}</span>
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}

/**
 * The album's sequence as a track sheet (`SpineSheet`) beside or above every album screen:
 * every row opens that track in the Studio. The side column widens with the theme count so
 * the heads show names (15rem plus 3rem a theme, `themeHeadClasses`: up to four themes on a
 * laptop, all six in the Sequence disclosure); only the narrowest column falls back to keys.
 *
 * `showThemes={false}` leaves the theme columns out (number, title, lyrics and role stay): the
 * Story bible's Theme map already sets the tracks against the themes, and one screen shows
 * that relationship once.
 */
export function AlbumSpine({
  albumId,
  rows,
  themes,
  heading = true,
  idPrefix = "album-spine",
  showThemes = true,
}: {
  albumId: string;
  rows: SpineRow[];
  /** The album's central themes, at most six, in the order the artist set them. */
  themes: string[];
  /** The side column shows a "Sequence" heading; the compact disclosure has its own summary. */
  heading?: boolean;
  idPrefix?: string;
  /** Theme columns under the theme heads; false where the page has its own theme map. */
  showThemes?: boolean;
}) {
  const base = `/app/albums/${albumId}`;
  const shownThemes = showThemes ? themes : [];

  const body = rows.length ? (
    <SpineSheet
      rows={rows}
      themes={shownThemes}
      heads={albumSpineHeads(shownThemes.length)}
      rowHref={(trackNumber) => `${base}/studio?song=${trackNumber}`}
      caption={
        showThemes
          ? "Tracks in sequence: lyrics written, the album themes each track carries, and whether it has a role in the arc. Select a title to open the track in the Studio."
          : "Tracks in sequence: lyrics written and whether each track has a role in the arc. Select a title to open the track in the Studio."
      }
      legendId={`${idPrefix}-theme-keys`}
    />
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
      {rows.length && showThemes && !themes.length ? (
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
