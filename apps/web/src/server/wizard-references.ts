// The records an artist names in the create wizard ("References" on its Direction step) become
// entries in the album's one References collection, scoped to the whole album (no song target),
// so they show up on the References page and in the Overview count instead of living only in the
// snapshot's `reference_albums` list. The artist adds the details (artist, role, tags) later.

/** Matches the References form's own limits (server/references ReferenceBodySchema). */
const MAX_TITLE_LENGTH = 200;
/** The wizard is a first pass; a longer list than this is almost certainly a paste accident. */
export const MAX_WIZARD_REFERENCES = 24;

export type WizardReferenceRow = {
  albumId: string;
  songId: null;
  songTrackNumber: null;
  songTitle: null;
  title: string;
  moodTags: string[];
  arrangementTags: string[];
};

/**
 * The album-scoped reference rows to create for an album's wizard references: trimmed, with
 * blanks and case-insensitive duplicates dropped, titles capped at the form's length, in the
 * order the artist typed them. Empty when the wizard named none.
 */
export function wizardReferenceRows(
  albumId: string,
  referenceAlbums: readonly string[] | null | undefined,
): WizardReferenceRow[] {
  const seen = new Set<string>();
  const rows: WizardReferenceRow[] = [];
  for (const raw of referenceAlbums ?? []) {
    if (typeof raw !== "string") continue;
    const title = raw.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE_LENGTH).trim();
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      albumId,
      songId: null,
      songTrackNumber: null,
      songTitle: null,
      title,
      moodTags: [],
      arrangementTags: [],
    });
    if (rows.length >= MAX_WIZARD_REFERENCES) break;
  }
  return rows;
}
