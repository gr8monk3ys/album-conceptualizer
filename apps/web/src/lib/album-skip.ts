/**
 * The album frame's skip link names where it lands: the page under the release header, tabs
 * and sequence ("Skip to the Coherence report"). Null on the Studio, whose skip link is "Skip
 * to the lyrics".
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

/** The app shell's main column, where every other page's content starts. */
export const APP_MAIN_ID = "app-main-content";

/** The Studio's editor column; its own "Skip to the lyrics" goes on to the section's lyrics. */
export const STUDIO_EDITOR_ID = "studio-editor";

/**
 * The page's one skip link, the first stop on every screen of the app: past the sidebar and
 * the header to the page's own content. On an album screen that is past the release header,
 * the tabs and the sequence too, and it is named for the page ("Skip to the Coherence
 * report"); on the Studio it is "Skip to the lyrics"; elsewhere "Skip to content".
 */
export function appSkipTarget(pathname: string): { label: string; targetId: string; studio: boolean } {
  const match = /^\/app\/albums\/([^/]+)(?:\/([^/?#]*))?/.exec(pathname);
  if (!match) return { label: "Skip to content", targetId: APP_MAIN_ID, studio: false };
  const segment = match[2] ?? "";
  if (segment === "studio") return { label: "Skip to the lyrics", targetId: STUDIO_EDITOR_ID, studio: true };
  return { label: albumSkipLabel(segment) ?? "Skip to the page", targetId: ALBUM_PAGE_ID, studio: false };
}

/**
 * The status item of an album's catalog line: an album on Discover reads "On Discover" once
 * (publishing sets both the status and the visibility, so "Published · On Discover" said it
 * twice); otherwise the status in words ("Draft").
 */
export function albumCatalogStatus(album: { status: string; isPublic?: boolean | null }, label: (status: string) => string) {
  return album.isPublic ? "On Discover" : label(album.status);
}
