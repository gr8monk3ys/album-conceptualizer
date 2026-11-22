/**
 * What an address inside an album asked for, after /app/albums/<id>/: decoded, and cut to 60
 * characters so a long pasted path can't take over the not-found screen. Null when the
 * address isn't inside an album.
 */
export function missingAlbumPage(pathname: string): { albumId: string; page: string } | null {
  const match = pathname.match(/^\/app\/albums\/([^/?#]+)\/([^?#]+?)\/?(?:[?#].*)?$/);
  if (!match) return null;
  const [, albumId, rawPage] = match;
  if (albumId === undefined || rawPage === undefined) return null;
  let page = rawPage;
  try {
    page = decodeURIComponent(rawPage);
  } catch {
    // A malformed escape: show the address as typed.
  }
  return { albumId, page: page.length > 60 ? `${page.slice(0, 59)}…` : page };
}
