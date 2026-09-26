import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogItems, albumStatusLabel } from "@/components/album-card";
import { AlbumBody, AlbumNav, AlbumNextAction } from "@/components/album-nav";
import { AlbumSpine } from "@/components/album-spine";
import { RelativeTime } from "@/components/relative-time";
import { ReleaseTitle } from "@/components/release-title";
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

  // On the Studio (the page that renders #studio-editor) the release header compresses so the
  // lyrics reach the first viewport ("Writing comes first"): the title steps down to 1.875rem,
  // the catalog line sits beside it on its baseline, and the frame's gaps tighten. Pure CSS
  // (`:has()`), so it applies on the server render and nothing moves after hydration; every
  // other album screen keeps the full release header.
  return (
    <div className="group/album flex min-w-0 flex-col gap-6 has-[#studio-editor]:gap-4">
      {/* A size container, so the release title steps down in a narrow header (a phone at
          200% text) instead of breaking inside words (--text-display-release). */}
      <header className="@container flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 max-w-full flex-col gap-3 group-has-[#studio-editor]/album:flex-row group-has-[#studio-editor]/album:flex-wrap group-has-[#studio-editor]/album:items-baseline group-has-[#studio-editor]/album:gap-x-4 group-has-[#studio-editor]/album:gap-y-1">
          {/* 18.75em is 24ch of the display cut, set in em so the measure is the same before
              and after Archivo loads (the fallback's "0" is narrower). The page's h1, except
              under an address the album has no page for, where the not-found heading is. */}
          <ReleaseTitle
            albumId={album.id}
            className="type-display text-display-release max-w-[18.75em] break-words text-ink hyphens-auto group-has-[#studio-editor]/album:min-w-0 group-has-[#studio-editor]/album:text-3xl"
          >
            {album.title}
          </ReleaseTitle>
          {/* Each separator stays with the item after it, so a wrapped line never ends on a dot. */}
          <p className="type-catalog flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-2">
            <CatalogItems
              items={[
                album.artist || "No artist yet",
                <span key="tracks" className="type-figure">
                  {rows.length} {rows.length === 1 ? "track" : "tracks"}
                </span>,
                albumStatusLabel(album.status),
                album.isPublic ? "On Discover" : null,
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
                <span key="edited">
                  Edited <RelativeTime date={album.updatedAt.toISOString()} />
                </span>,
                // Versions open from here on every album tab, not only from the Overview.
                <Link key="versions" href={`/app/albums/${album.id}/versions`} className={CATALOG_LINK}>
                  Version history
                </Link>,
              ]}
            />
          </p>
        </div>
        <AlbumNextAction albumId={album.id} step={{ action: step.action, href: step.href }} />
      </header>
      <AlbumNav albumId={album.id} />
      <AlbumBody
        trackCount={rows.length}
        themeCount={themes.length}
        spine={<AlbumSpine albumId={album.id} rows={rows} themes={themes} />}
        compactSpine={
          <AlbumSpine albumId={album.id} rows={rows} themes={themes} heading={false} idPrefix="album-spine-compact" />
        }
      >
        {children}
      </AlbumBody>
    </div>
  );
}
