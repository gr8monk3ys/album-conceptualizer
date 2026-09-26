import { SpineSheet, type SpineHeads } from "@/components/album-spine";
import type { SpineRow } from "@/server/album-songs";

/**
 * Theme heads by the room the spine has, as the album's own spine does: the theme's whole name
 * in catalog caps over its slot (on two lines when one won't hold it) where it fits, short
 * keys and a legend only where it doesn't. There is no link column to leave room for, so the
 * names come in sooner than on the album's spine: up to three themes take 5rem slots from a
 * 32rem container, four to six take 4rem slots from 42rem (the number, lyrics and role
 * columns, an 8rem title and the slots). Rem, so enlarged text needs more room. (Literal
 * class names, so Tailwind generates them.)
 */
const THEME_HEADS = {
  few: { keys: "@lg:hidden", names: "hidden @lg:block", slot: "@lg:w-20", legend: "@lg:hidden", nameRem: 4.75 },
  many: { keys: "@2xl:hidden", names: "hidden @2xl:block", slot: "@2xl:w-16", legend: "@2xl:hidden", nameRem: 3.75 },
} satisfies Record<string, SpineHeads>;

/**
 * The album's sequence as the same track sheet the album shows its artist (`SpineSheet`),
 * read only: for a published album on Discover, and the setup wizard's preview of the spine an
 * album will start with. A title links to an in-page target (`anchorFor`, e.g. the track's
 * lyric excerpt) when there is one, instead of into a Studio the reader may not own, and is
 * plain text otherwise. A screen reader hears each row once. Client and Server Components can
 * both render it.
 */
export function ReadOnlySpine({
  rows,
  themes,
  anchorFor,
  idPrefix = "read-only-spine",
}: {
  rows: SpineRow[];
  /** The album's central themes, at most six, in the artist's order. */
  themes: string[];
  /** The in-page id a track's title links to, or null for plain text. */
  anchorFor?: (trackNumber: number) => string | null;
  idPrefix?: string;
}) {
  return (
    // A size container: the theme heads choose names or keys by the room the spine has.
    <div className="@container">
      <SpineSheet
        rows={rows}
        themes={themes}
        heads={themes.length <= 3 ? THEME_HEADS.few : THEME_HEADS.many}
        rowHref={(trackNumber) => {
          const anchor = anchorFor?.(trackNumber) ?? null;
          return anchor ? `#${anchor}` : null;
        }}
        caption="Tracks in sequence: lyrics written, the album themes each track carries, and whether it has a role in the arc."
        legendId={`${idPrefix}-theme-keys`}
      />
    </div>
  );
}
