import { notFound } from "next/navigation";
import { cache } from "react";

import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

// Titles for the browser tab (generateMetadata). Each lookup reads only the title and is
// cached for the request, so a page's metadata costs one small query.
//
// A missing album is not found here too, not just in the page: generateMetadata that calls
// notFound() makes Next resolve the not-found screen's metadata ("Page not found"), where a
// fallback title ("Album overview", "Discover") would replace the not-found title in the tab
// once the page hydrated (WCAG 2.4.2). Every caller is a page whose own render also calls
// notFound() for the same album, so the two always agree.

/**
 * A published album's title, for "<title> · Discover". Not found when it isn't published;
 * null only for a published album with a blank title.
 */
export const publishedAlbumTitle = cache(async (albumId: string): Promise<string | null> => {
  const album = await getPrisma().album.findFirst({
    where: { id: albumId, isPublic: true },
    select: { title: true },
  });
  if (!album) notFound();
  return album.title.trim() || null;
});

/**
 * The title of an album in the viewer's workspace. Not found when it isn't theirs; null only
 * for an album with a blank title.
 */
export const workspaceAlbumTitle = cache(async (albumId: string): Promise<string | null> => {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getPrisma().album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { title: true },
  });
  if (!album) notFound();
  return album.title.trim() || null;
});

/** "Style · Night Drive": a page of an album, or just the page when the album is unknown. */
export function albumPageTitle(page: string, albumTitle: string | null): string {
  return albumTitle ? `${page} · ${albumTitle}` : page;
}
