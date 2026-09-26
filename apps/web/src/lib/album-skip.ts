/**
 * The album frame's skip link names where it lands: the page under the release header, tabs
 * and sequence ("Skip to the Coherence report"). Null on the Studio, whose own "Skip to the
 * lyrics" is the first stop in its content, so there is never a second one.
 */
const SKIP_LABELS: Record<string, string> = {
  "": "Skip to the Overview",
  inbox: "Skip to comments and tasks",
  bible: "Skip to the Story bible",
  coherence: "Skip to the Coherence report",
  sound: "Skip to the Sound bible",
  style: "Skip to the Sound bible",
  references: "Skip to References",
  demos: "Skip to Demos",
  export: "Skip to Export",
  versions: "Skip to Version history",
};

/** `segment` is the first path segment after /app/albums/<id> ("" on the Overview). */
export function albumSkipLabel(segment: string): string | null {
  if (segment === "studio") return null;
  return SKIP_LABELS[segment] ?? "Skip to the page";
}

/** The element the skip link lands on: the album page's own content column. */
export const ALBUM_PAGE_ID = "album-page";

/**
 * The status item of an album's catalog line: an album on Discover reads "On Discover" once
 * (publishing sets both the status and the visibility, so "Published · On Discover" said it
 * twice); otherwise the status in words ("Draft").
 */
export function albumCatalogStatus(album: { status: string; isPublic?: boolean | null }, label: (status: string) => string) {
  return album.isPublic ? "On Discover" : label(album.status);
}
