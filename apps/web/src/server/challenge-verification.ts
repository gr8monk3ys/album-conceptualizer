import { isWrittenLyrics } from "@/lib/lyrics";

// Whether a challenge entry earns its credits. The note is the artist's word; the credits are
// paid for writing the album shows: the linked track (or, with no track, any track of the
// linked album) must have written lyrics (@/lib/lyrics) that are new today, UTC.
//
// There is no per-section edit time (every save rebuilds the album's rows), so "new today" is
// read from the album itself: it was saved today, and its written lyrics include something
// that wasn't in the album before today. "Before today" is the latest version saved before
// 00:00 UTC. An album made today counts from nothing, unless it is a remix: then from its
// first version, the copy of the original it started as, so copied lyrics aren't new writing.
// An older album with no version from before today can't be compared, so a save today with
// written lyrics is taken at its word.

type Raw = Record<string, unknown>;

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function songsOf(data: unknown): Raw[] {
  return asList((data as { songs?: unknown } | null)?.songs).filter(
    (raw): raw is Raw => Boolean(raw) && typeof raw === "object",
  );
}

/** Lyrics compared as the artist sees them: placeholders and spacing don't make a change. */
function normalizeLyrics(lyrics: string) {
  return lyrics.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Every written section's lyrics in `data`, normalised; only `trackNumber`'s when given. */
export function writtenLyricTexts(data: unknown, trackNumber: number | null = null): string[] {
  const texts: string[] = [];
  for (const song of songsOf(data)) {
    if (trackNumber !== null && song.track_number !== trackNumber) continue;
    for (const section of asList(song.sections)) {
      const lyrics = (section as { lyrics?: unknown } | null)?.lyrics;
      if (isWrittenLyrics(lyrics)) texts.push(normalizeLyrics(lyrics as string));
    }
  }
  return texts;
}

/** A remix records the album it came from (`remixed_from`, written by Remix). */
function isRemix(data: unknown) {
  const source = (data as { remixed_from?: unknown } | null)?.remixed_from;
  return Boolean(source) && typeof source === "object";
}

/** 00:00 UTC on the day `now` falls in. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type ChallengeWritingInput = {
  now: Date;
  /** The linked album as it is now. */
  album: { data: unknown; createdAt: Date; updatedAt: Date };
  /** The track the entry was written for, or null for the whole album. */
  trackNumber: number | null;
  /** The album's latest version saved before today (UTC), if any. */
  versionBeforeToday: { data: unknown } | null;
  /** The album's first version (a remix records the copy it started from), if any. */
  firstVersion: { data: unknown } | null;
};

export type ChallengeWritingCheck =
  | { verified: true }
  | { verified: false; reason: "no-lyrics" | "not-saved-today" | "unchanged" };

/** Whether the linked track (or album) has written lyrics that are new today, UTC. */
export function checkChallengeWriting(input: ChallengeWritingInput): ChallengeWritingCheck {
  const current = writtenLyricTexts(input.album.data, input.trackNumber);
  if (!current.length) return { verified: false, reason: "no-lyrics" };

  const dayStart = startOfUtcDay(input.now);
  if (input.album.updatedAt < dayStart) return { verified: false, reason: "not-saved-today" };

  const baseline = input.versionBeforeToday
    ? input.versionBeforeToday.data
    : input.album.createdAt >= dayStart
      ? // Made today: a remix compares with the copy it started as; anything else with nothing.
        isRemix(input.album.data)
        ? (input.firstVersion?.data ?? null)
        : null
      : undefined;
  // An older album with no earlier version: nothing to compare with, and it was saved today.
  if (baseline === undefined) return { verified: true };

  // Across the whole album, so moving a verse to another track isn't new writing.
  const before = new Set(writtenLyricTexts(baseline));
  return current.some((text) => !before.has(text))
    ? { verified: true }
    : { verified: false, reason: "unchanged" };
}

/** What the artist is told when the note is saved without credits, in one plain sentence. */
export function challengeWritingReason(
  reason: "no-lyrics" | "not-saved-today" | "unchanged",
  target: { albumTitle: string; trackNumber: number | null },
): string {
  const where =
    target.trackNumber !== null
      ? `track ${String(target.trackNumber).padStart(2, "0")} of ${target.albumTitle}`
      : target.albumTitle;
  switch (reason) {
    case "no-lyrics":
      return `Note saved, no credits yet: ${where} has no written lyrics. Write them in the Studio, then check again.`;
    case "not-saved-today":
      return `Note saved, no credits yet: ${where} hasn't been written in today. Write in the Studio today, then check again.`;
    case "unchanged":
      return `Note saved, no credits yet: the lyrics on ${where} are the same as before today. Write something new in the Studio, then check again.`;
  }
}
