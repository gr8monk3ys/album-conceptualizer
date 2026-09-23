import { cache } from "react";

import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

// Titles for the browser tab (generateMetadata). Each lookup reads only the title and is
// cached for the request, so a page's metadata costs one small query.

/** A published album's title, for "<title> · Discover"; null when it isn't published. */
export const publishedAlbumTitle = cache(async (albumId: string): Promise<string | null> => {
  const album = await getPrisma().album.findFirst({
    where: { id: albumId, isPublic: true },
    select: { title: true },
  });
  return album?.title.trim() || null;
});

/** The title of an album in the viewer's workspace; null when it isn't theirs. */
export const workspaceAlbumTitle = cache(async (albumId: string): Promise<string | null> => {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getPrisma().album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { title: true },
  });
  return album?.title.trim() || null;
});

/** "Style · Night Drive": a page of an album, or just the page when the album is unknown. */
export function albumPageTitle(page: string, albumTitle: string | null): string {
  return albumTitle ? `${page} · ${albumTitle}` : page;
}
