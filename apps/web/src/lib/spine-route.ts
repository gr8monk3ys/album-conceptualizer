// Which album page the frame is showing, for what the spine beside it carries.

/** The album page a pathname opens: "" for the Overview, "bible", "studio"…; null off an album. */
export function albumPageSegment(pathname: string | null | undefined): string | null {
  const match = pathname?.match(/^\/app\/albums\/[^/?#]+(?:\/([^/?#]*))?/);
  return match ? (match[1] ?? "") : null;
}

/**
 * Whether the spine shows its theme columns on this album page. Not on the Story bible, whose
 * Theme map shows the same tracks against the same themes: one relationship view per screen.
 */
export function spineShowsThemes(pathname: string | null | undefined): boolean {
  return albumPageSegment(pathname) !== "bible";
}
