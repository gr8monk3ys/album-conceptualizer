/**
 * What an address inside an album asked for, after /app/albums/<id>/: decoded, and cut to 60
 * characters so a long pasted path can't take over the not-found screen. Null when the
 * address isn't inside an album.
 */
export function missingAlbumPage(pathname: string): { albumId: string; page: string } | null {
  const match = pathname.match(/^\/app\/albums\/([^/?#]+)\/([^?#]+?)\/?(?:[?#].*)?$/);
  if (!match) return null;
  let page = match[2];
  try {
    page = decodeURIComponent(page);
  } catch {
    // A malformed escape: show the address as typed.
  }
  return { albumId: match[1], page: page.length > 60 ? `${page.slice(0, 59)}…` : page };
}
