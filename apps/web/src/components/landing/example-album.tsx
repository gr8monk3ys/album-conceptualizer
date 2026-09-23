import { cn } from "@/lib/utils";
import { ThemeMark } from "@/components/theme-mark";
import { carriedThemesPhrase } from "@/lib/theme-keys";

/**
 * An invented album, shown on the landing page as a worked example of the product's
 * signature output: the sequence (the spine) with each track's role, and the
 * theme × track matrix that shows which themes each track carries. It is example content,
 * labelled as such wherever it appears; it describes no real artist or customer.
 */

const THEMES = ["Isolation", "Duty", "Memory", "Weather", "Release"] as const;
type Theme = (typeof THEMES)[number];

type ExampleTrack = {
  number: number;
  title: string;
  role: string;
  summary: string;
  themes: Theme[];
};

export const EXAMPLE_ALBUM: { title: string; arc: string; concept: string; tracks: ExampleTrack[] } = {
  title: "Salt Signal",
  arc: "Three-act arc",
  concept:
    "A night-shift radio operator keeps a coastal station on air after the town is evacuated, talking to listeners who may no longer be there.",
  tracks: [
    {
      number: 1,
      title: "Call Sign",
      role: "Opening",
      summary: "The station, the night, the voice.",
      themes: ["Isolation", "Duty"],
    },
    {
      number: 2,
      title: "Evacuation Order",
      role: "Inciting incident",
      summary: "The town leaves. She stays on air.",
      themes: ["Duty", "Weather"],
    },
    {
      number: 3,
      title: "Empty Frequencies",
      role: "Rising action",
      summary: "Nobody calls in.",
      themes: ["Isolation", "Memory"],
    },
    {
      number: 4,
      title: "Requests from ’98",
      role: "Flashback",
      summary: "She replays old dedications.",
      themes: ["Memory"],
    },
    {
      number: 5,
      title: "Storm Log",
      role: "Midpoint",
      summary: "The storm hits and the tower holds.",
      themes: ["Isolation", "Duty", "Weather"],
    },
    {
      number: 6,
      title: "A Voice on 7 MHz",
      role: "Complication",
      summary: "Someone answers.",
      themes: ["Isolation", "Memory"],
    },
    {
      number: 7,
      title: "Handing Over the Mic",
      role: "Climax",
      summary: "She lets the stranger broadcast.",
      themes: ["Duty", "Release"],
    },
    {
      number: 8,
      title: "Sign-Off",
      role: "Resolution",
      summary: "The station goes quiet, by choice.",
      themes: ["Isolation", "Memory", "Release"],
    },
  ],
};

function ExampleThemeCell({ on }: { on: boolean }) {
  return (
    <span className="inline-grid h-8 w-full place-items-center">
      <ThemeMark carries={on} />
    </span>
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * The example rendered as a release sheet: title and catalog line, then one grid where every
 * row is a track (number, title, role) and every column after it is a theme. A screen
 * reader hears each row once, with one phrase for its themes, like the spine.
 */
export function ExampleAlbum({ className }: { className?: string }) {
  const { tracks } = EXAMPLE_ALBUM;
  const coverage = THEMES.map((theme) => tracks.filter((track) => track.themes.includes(theme)).length);

  return (
    <figure className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="example-album-title" className="type-display text-3xl text-ink md:text-4xl">
            {EXAMPLE_ALBUM.title}
          </h2>
          <p className="type-catalog mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            <span>Example album</span>
            <span aria-hidden="true">·</span>
            <span className="type-figure">{tracks.length} tracks</span>
            <span aria-hidden="true">·</span>
            <span>{EXAMPLE_ALBUM.arc}</span>
            <span aria-hidden="true">·</span>
            <span className="type-figure">{THEMES.length} themes</span>
          </p>
        </div>
      </div>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-2">{EXAMPLE_ALBUM.concept}</p>

      <div
        className="relative mt-5 overflow-x-auto"
        role="region"
        tabIndex={0}
        aria-label="Example album sequence and themes"
      >
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Sequence of the example album {EXAMPLE_ALBUM.title}: each track with its role, and
            which of the album&apos;s themes it carries.
          </caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="type-catalog w-9 py-2 pr-2 align-bottom text-xs text-ink-3 sm:w-12">
                <span className="sr-only">Track number</span>
                <span aria-hidden="true">#</span>
              </th>
              <th scope="col" className="type-catalog py-2 pr-2 align-bottom text-xs text-ink-3 sm:pr-4">
                Track and role
              </th>
              {THEMES.map((theme) => (
                <th
                  key={theme}
                  scope="col"
                  // The row header already says which themes a track carries.
                  aria-hidden="true"
                  className="type-catalog w-8 px-0.5 py-2 text-center align-bottom text-xs leading-tight text-ink-2 sm:w-[4.5rem] sm:px-1"
                >
                  {/* Narrow screens show the initial; the key under the grid spells it out. */}
                  <span aria-hidden="true" className="sm:hidden">
                    {theme.charAt(0)}
                  </span>
                  <span className="max-sm:hidden">{theme}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr key={track.number} className="border-b border-line">
                <td className="type-figure py-2 pr-2 align-top text-lg font-semibold text-ink-3 sm:text-xl">
                  {pad(track.number)}
                </td>
                <th scope="row" className="py-2 pr-2 align-top font-normal sm:pr-4">
                  <span className="block text-sm font-semibold text-ink">{track.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">
                    <span className="text-ink-2">{track.role}.</span>{" "}
                    <span className="hidden sm:inline">{track.summary}</span>
                  </span>
                  <span className="sr-only">
                    {carriedThemesPhrase(
                      THEMES.filter((theme) => track.themes.includes(theme)),
                      THEMES.length,
                    )}
                  </span>
                </th>
                {THEMES.map((theme) => (
                  <td key={theme} aria-hidden="true" className="px-0.5 align-middle sm:px-1">
                    <ExampleThemeCell on={track.themes.includes(theme)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2 pr-2" />
              <th scope="row" className="type-catalog py-2 pr-2 text-xs font-semibold text-ink-3 sm:pr-4">
                Tracks carrying it
                <span className="sr-only">
                  :{" "}
                  {THEMES.map((theme, index) => `${theme} ${coverage[index]} of ${tracks.length}`).join(", ")}
                </span>
              </th>
              {coverage.map((count, index) => (
                <td
                  key={THEMES[index]}
                  aria-hidden="true"
                  className="type-figure px-0.5 py-2 text-center text-sm text-ink-2 sm:px-1"
                >
                  {count}/{tracks.length}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="type-catalog mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3 sm:hidden" aria-hidden="true">
        {THEMES.map((theme) => (
          <span key={theme}>
            <span className="text-ink-2">{theme.charAt(0)}</span> {theme}
          </span>
        ))}
      </p>

      <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">What the grid shows: </span>
        “Release” carries the ending but first appears on track 7. Seeding it earlier, around track
        4, would make the resolution feel earned.
      </p>
      <figcaption className="mt-3 text-xs leading-relaxed text-ink-3">
        Example album, invented for this page to show what a blueprint looks like.
      </figcaption>
    </figure>
  );
}
