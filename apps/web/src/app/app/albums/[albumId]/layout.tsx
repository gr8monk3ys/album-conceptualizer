import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogItems, albumStatusLabel } from "@/components/album-card";
import { AlbumCatalogLink } from "@/components/album-catalog-link";
import { AlbumFrameBody } from "@/components/album-frame-body";
import { AlbumFrame, AlbumNav, AlbumNextAction, AlbumSkipLink } from "@/components/album-nav";
import { RelativeTime } from "@/components/relative-time";
import { ReleaseTitle } from "@/components/release-title";
import { albumCatalogStatus } from "@/lib/album-skip";
import { getSpineRows, getSpineThemes, nextAlbumStep } from "@/server/album-songs";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { remixSource, remixSourceHref } from "@/server/remix-source";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

// A quiet link inside the catalog line: catalog caps in Stone Ink with the Strong Rule
// underline. The line stays one line of small caps; the link's 44px target is an invisible
// box stretched above and below its text (after:), so the target doesn't loosen the lock-up
// of title and catalog line. The link is set as a block of the line's own height (16px) and
// the box reaches 16px past it each way: 48px, clear of the 44px minimum (stretched 14px from
// an inline box it measured 42px).
const CATALOG_LINK =
  "relative inline-block underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink after:absolute after:inset-x-0 after:-inset-y-4";

/** The release header, album navigation and spine shared by every album screen. */
export default async function AlbumLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();
  const rows = getSpineRows(album.data);
  const themes = getSpineThemes(album.data);
  const step = nextAlbumStep(album.id, album.data);
  const remix = remixSource(album.data);
  const remixHref = await remixSourceHref(remix);

  // On the Studio the release header compresses so the lyrics reach the first viewport
  // ("Writing comes first"): the title steps down to 1.875rem, the catalog line sits beside it
  // on its baseline, and the frame's gaps tighten. The frame knows its page from the address
  // (`AlbumFrame` sets data-page, in the server render too), so nothing moves after hydration,
  // and typing in the Studio doesn't re-style the frame (a `:has(#studio-editor)` did, on every
  // keystroke). Every other album screen keeps the full release header. On a phone the frame's
  // gaps tighten too, so the page starts sooner under the header and tabs.
  return (
    <AlbumFrame albumId={album.id} className="group/album flex min-w-0 flex-col gap-4 md:gap-6 data-[page=studio]:gap-4">
      {/* A size container (release), so the release title steps down in a narrow header (a
          phone at 200% text) instead of breaking inside words (--text-display-release), and
          the header tightens and shortens its catalog line below 42rem and 30rem. */}
      {/* 20px between rows below 42rem: the Version history link's stretched 48px target reaches
          16px past its line, and a 12px gap let it cover the top of the next-step button. */}
      <header className="@container/release flex flex-wrap items-end justify-between gap-x-8 gap-y-5 @min-[42rem]/release:gap-y-4">
        <div className="flex min-w-0 max-w-full flex-col gap-2 @min-[42rem]/release:gap-3 group-data-[page=studio]/album:flex-row group-data-[page=studio]/album:flex-wrap group-data-[page=studio]/album:items-baseline group-data-[page=studio]/album:gap-x-4 group-data-[page=studio]/album:gap-y-1">
          {/* The first stop in the album frame: past the title, catalog line, tabs and
              sequence, to the page itself. A visible ink link in a narrow header (a phone,
              enlarged text), where those take a screen or more; focus-only from 42rem. Not
              on the Studio, whose own "Skip to the lyrics" is its first stop. */}
          <AlbumSkipLink albumId={album.id} />
          {/* On the Studio the compact size is capped by the header's width like the full
              one (13cqi, never under 1rem): a flat text-3xl set 60px at 320px with 200% text
              and broke "Lighthouse" inside the word. Under a 12rem header (320px with 200%
              text) both step down to 12% of the header, floor included: a 12-letter word
              ("Transmission", 7.9em in the display cut) then fits whole instead of losing its
              last letter to the next line; 13% still holds wherever the header is wider.
              18.75em is 24ch of the display cut, set in em so the measure is the same before
              and after Archivo loads (the fallback's "0" is narrower). The page's h1, except
              under an address the album has no page for, where the not-found heading is. */}
          <ReleaseTitle
            albumId={album.id}
            className="type-display text-display-release max-w-[18.75em] break-words text-ink hyphens-auto group-data-[page=studio]/album:min-w-0 group-data-[page=studio]/album:text-[length:max(1rem,min(1.875rem,13cqi))] group-data-[page=studio]/album:leading-[1.2] @max-[12rem]/release:text-[length:12cqi]"
          >
            {album.title}
          </ReleaseTitle>
          {/* Each separator ends the item before it, so a wrapped line never starts with a dot. */}
          <p className="type-catalog flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-2">
            <CatalogItems
              items={[
                album.artist || "No artist yet",
                <span key="tracks" className="type-figure">
                  {rows.length} {rows.length === 1 ? "track" : "tracks"}
                </span>,
                // Publishing sets the status and the visibility: said once, "On Discover".
                albumCatalogStatus(album, albumStatusLabel),
                remix ? (
                  // Provenance: the original artist's name stays on the remix, and links to the
                  // original on Discover while it is still published.
                  remixHref ? (
                    <Link key="remix" href={remixHref} className={CATALOG_LINK}>
                      Remix of {remix.title}
                      {remix.artist ? ` by ${remix.artist}` : ""}
                    </Link>
                  ) : (
                    <span key="remix">
                      Remix of {remix.title}
                      {remix.artist ? ` by ${remix.artist}` : ""}
                    </span>
                  )
                ) : null,
                // The least needed item: a narrow line (a phone, enlarged text) leaves it out,
                // so the line keeps to two or three lines. Never the last item, so the item
                // before keeps its separator for Version history.
                {
                  className: "hidden @min-[30rem]/release:inline",
                  content: (
                    <span key="edited">
                      Edited <RelativeTime date={album.updatedAt.toISOString()} />
                    </span>
                  ),
                },
                // Versions open from here on every album tab, not only from the Overview; on
                // the Version history page this link is the current location (no tab is).
                <AlbumCatalogLink key="versions" href={`/app/albums/${album.id}/versions`} className={CATALOG_LINK}>
                  Version history
                </AlbumCatalogLink>,
              ]}
            />
          </p>
        </div>
        <AlbumNextAction albumId={album.id} step={{ action: step.action, href: step.href }} />
      </header>
      <AlbumNav albumId={album.id} />
      {/* The spine for the page being shown: on the Story bible without its theme columns,
          which the page's own Theme map shows. */}
      <AlbumFrameBody albumId={album.id} rows={rows} themes={themes}>
        {children}
      </AlbumFrameBody>
    </AlbumFrame>
  );
}
