import Link from "next/link";
import { Check } from "lucide-react";

import { lyricFraction } from "@/components/album-spine";
import { ThemeMark } from "@/components/theme-mark";
import { TableScroller } from "@/components/ui";
import { carriedThemesPhrase, themeAbbreviations } from "@/lib/theme-keys";
import { cn } from "@/lib/utils";
import type { SpineRow } from "@/server/album-songs";

/**
 * Theme heads by the room the spine has, as the album's own spine does: the theme's full name
 * in catalog caps over its slot (truncated, with the full name on hover) where it fits, short
 * keys and a legend only where it doesn't. There is no link column to leave room for, so the
 * names come in sooner than on the album's spine: up to three themes take 5rem slots from a
 * 32rem container, four to six take 4rem slots from 42rem (the number, lyrics and role
 * columns, an 8rem title and the slots). Rem, so enlarged text needs more room. (Literal
 * class names, so Tailwind generates them.)
 */
const THEME_HEADS = {
  few: { keys: "@lg:hidden", names: "hidden @lg:block", slot: "@lg:w-20", legend: "@lg:hidden" },
  many: { keys: "@2xl:hidden", names: "hidden @2xl:block", slot: "@2xl:w-16", legend: "@2xl:hidden" },
} as const;

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

/**
 * The album's sequence as the same track sheet the album shows its artist (number, title,
 * lyrics written, one ThemeMark per album theme under the theme's name, Role), read only: for
 * a published album on Discover, and the setup wizard's preview of the spine an album will
 * start with. A title links to an in-page target (`anchorFor`, e.g. the track's lyric excerpt)
 * when there is one, instead of into a Studio the reader may not own. A screen reader hears
 * each row once. Client and Server Components can both render it.
 */
export function ReadOnlySpine({
  rows,
  themes,
  anchorFor,
}: {
  rows: SpineRow[];
  /** The album's central themes, at most six, in the artist's order. */
  themes: string[];
  /** The in-page id a track's title links to, or null for plain text. */
  anchorFor?: (trackNumber: number) => string | null;
}) {
  const themeKeys = themes.map((theme) => theme.toLowerCase());
  const abbreviations = themeAbbreviations(themes);
  const heads = themes.length <= 3 ? THEME_HEADS.few : THEME_HEADS.many;

  return (
    // A size container: the theme heads choose names or keys by the room the spine has.
    <div className="@container">
      <TableScroller label="Tracks in sequence">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Tracks in sequence: lyrics written, the album themes each track carries, and whether
            it has a role in the arc.
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
                  <span className="sr-only">Album themes</span>
                  <span aria-hidden="true" className="flex items-end justify-center">
                    {themes.map((theme, index) => (
                      <span key={theme} className={cn("block w-4 shrink-0 text-center", heads.slot)}>
                        <abbr
                          title={theme}
                          className={cn("type-catalog block text-xs text-ink-3 no-underline", heads.keys)}
                        >
                          {abbreviations[index]}
                        </abbr>
                        <span
                          title={theme}
                          className={cn(
                            "type-catalog truncate px-1 text-xs leading-tight text-ink-3",
                            heads.names,
                          )}
                        >
                          {theme}
                        </span>
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
              const anchor = anchorFor?.(row.trackNumber) ?? null;
              return (
                <tr
                  key={row.trackNumber}
                  className={cn(
                    "border-b border-line",
                    anchor && "relative transition-colors hover:bg-hover has-[a:focus-visible]:bg-hover",
                  )}
                >
                  <td className="type-figure h-11 py-1.5 pr-1 align-middle text-sm font-semibold text-ink-3">
                    {pad(row.trackNumber)}
                  </td>
                  <td className="py-1.5 pr-2 align-middle">
                    {anchor ? (
                      // Stretched over the row, so any cell is a 44px target.
                      <Link
                        href={`#${anchor}`}
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
      {themes.length ? (
        // The key for the theme columns while they show keys; screen readers hear names.
        <p
          aria-hidden="true"
          className={cn("mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-ink-3", heads.legend)}
        >
          {themes.map((theme, index) => (
            <span key={theme} className="min-w-0 break-words">
              <span className="type-catalog text-ink-2">{abbreviations[index]}</span> {theme}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
