import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AlbumBody, AlbumNav } from "@/components/album-nav";
import { AlbumSpine } from "@/components/album-spine";
import { RelativeTime } from "@/components/relative-time";
import { getSpineRows } from "@/server/album-songs";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Published", archived: "Archived" };

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="type-display max-w-[24ch] text-4xl text-ink md:text-6xl">{album.title}</h1>
        <p className="type-catalog flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
          <span>{album.artist || "No artist yet"}</span>
          <span aria-hidden="true">·</span>
          <span className="type-figure">{rows.length} {rows.length === 1 ? "track" : "tracks"}</span>
          <span aria-hidden="true">·</span>
          <span>{STATUS_LABEL[album.status] ?? album.status}{album.isPublic ? " · On Discover" : ""}</span>
          <span aria-hidden="true">·</span>
          <span>
            Edited <RelativeTime date={album.updatedAt.toISOString()} />
          </span>
        </p>
      </header>
      <AlbumNav albumId={album.id} />
      <AlbumBody spine={<AlbumSpine albumId={album.id} rows={rows} />}>{children}</AlbumBody>
    </div>
  );
}
