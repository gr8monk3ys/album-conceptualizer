import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AlbumBody, AlbumNav, AlbumNextAction } from "@/components/album-nav";
import { AlbumSpine } from "@/components/album-spine";
import { RelativeTime } from "@/components/relative-time";
import { getSpineRows, getSpineThemes, nextAlbumStep } from "@/server/album-songs";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Published", archived: "Archived" };

/** `remixed_from` is written by Remix when it forks an album; older albums don't have it. */
function remixSource(data: unknown) {
  const source = (data as { remixed_from?: unknown } | null)?.remixed_from;
  if (!source || typeof source !== "object") return null;
  const { title, artist } = source as { title?: unknown; artist?: unknown };
  if (typeof title !== "string" || !title.trim()) return null;
  return { title: title.trim(), artist: typeof artist === "string" && artist.trim() ? artist.trim() : null };
}

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

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 max-w-full flex-col gap-3">
          <h1 className="type-display text-display-release max-w-[24ch] break-words text-ink hyphens-auto">
            {album.title}
          </h1>
          <p className="type-catalog flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            <span className="break-words">{album.artist || "No artist yet"}</span>
            <span aria-hidden="true">·</span>
            <span className="type-figure">
              {rows.length} {rows.length === 1 ? "track" : "tracks"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {STATUS_LABEL[album.status] ?? album.status}
              {album.isPublic ? " · On Discover" : ""}
            </span>
            {remix ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="break-words">
                  Remix of {remix.title}
                  {remix.artist ? ` by ${remix.artist}` : ""}
                </span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>
              Edited <RelativeTime date={album.updatedAt.toISOString()} />
            </span>
          </p>
        </div>
        <AlbumNextAction albumId={album.id} step={{ action: step.action, href: step.href }} />
      </header>
      <AlbumNav albumId={album.id} />
      <AlbumBody
        trackCount={rows.length}
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
