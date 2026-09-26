import { SpineSheet } from "@/components/album-spine";
import type { SpineRow } from "@/server/album-songs";

/**
 * The album's sequence as the same track sheet the album shows its artist (`SpineSheet`),
 * read only: for a published album on Discover, and the setup wizard's preview of the spine an
 * album will start with. A title links to an in-page target (`anchorFor`, e.g. the track's
 * lyric excerpt) when there is one, instead of into a Studio the reader may not own, and is
 * plain text otherwise. The theme heads follow the room exactly as the album's own spine's do
 * (whole names where the sheet holds them, 3rem slots, then keys). A screen reader hears each
 * row once. Client and Server Components can both render it.
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
