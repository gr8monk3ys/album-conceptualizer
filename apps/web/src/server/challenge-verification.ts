import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { isWrittenLyrics } from "@/lib/lyrics";
import { asList } from "@/lib/snapshot-values";

// Whether a challenge entry earns its credits. The note is the artist's word; the credits are
// paid for writing the album shows: the linked track (or, with no track, any track of the
// linked album) must have written lyrics (@/lib/lyrics) that are new today, UTC.
//
// There is no per-section edit time (every save rebuilds the album's rows), so "new today" is
// measured against a baseline: the album's written lyrics as they stood before it was written
// in today. Opening the day's challenge records that baseline (`recordLyricsBaselines`) for
// every album not yet saved today, when its snapshot is still the one from before today;
// sending an entry records it for the linked album if it is missing. An album made today counts
// from nothing, unless it is a remix: then from its first version, the copy of the original it
// started as, so copied lyrics aren't new writing. An older album already written in today
// before any baseline was recorded can't be measured: the entry is saved without credits, its
// lyrics become the baseline, and what is written after that pays. The latest version saved
// before today, when there is one, counts as "before today" as well.

type Raw = Record<string, unknown>;

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

/** A written lyric text as the baseline stores it: a short hash, not the words themselves. */
export function lyricHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** The hashes of every written lyric text in `data` (the whole album), as a baseline records them. */
export function lyricBaselineHashes(data: unknown): string[] {
  return [...new Set(writtenLyricTexts(data).map(lyricHash))];
}

export type ChallengeWritingInput = {
  now: Date;
  /** The linked album as it is now. */
  album: { data: unknown; createdAt: Date; updatedAt: Date };
  /** The track the entry was written for, or null for the whole album. */
  trackNumber: number | null;
  /** The album's lyric hashes recorded today before it was written in (`recordLyricsBaselines`), if any. */
  dayBaseline: { lyricHashes: string[] } | null;
  /** The album's latest version saved before today (UTC), if any. */
  versionBeforeToday: { data: unknown } | null;
  /** The album's first version (a remix records the copy it started from), if any. */
  firstVersion: { data: unknown } | null;
};

export type ChallengeWritingReason = "no-lyrics" | "not-saved-today" | "unchanged" | "no-baseline";

export type ChallengeWritingCheck = { verified: true } | { verified: false; reason: ChallengeWritingReason };

/** Whether the linked track (or album) has written lyrics that are new today, UTC. */
export function checkChallengeWriting(input: ChallengeWritingInput): ChallengeWritingCheck {
  const current = writtenLyricTexts(input.album.data, input.trackNumber);
  if (!current.length) return { verified: false, reason: "no-lyrics" };

  const dayStart = startOfUtcDay(input.now);
  if (input.album.updatedAt < dayStart) return { verified: false, reason: "not-saved-today" };

  // Everything known to have been written before today's writing, across the whole album, so
  // moving a verse to another track isn't new writing.
  const madeToday = input.album.createdAt >= dayStart;
  const before = new Set(input.dayBaseline?.lyricHashes ?? []);
  const earlier = [input.versionBeforeToday?.data];
  // Made today: a remix compares with the copy it started as; anything else with nothing.
  if (madeToday && isRemix(input.album.data)) earlier.push(input.firstVersion?.data);
  for (const data of earlier) for (const hash of lyricBaselineHashes(data)) before.add(hash);

  if (!current.some((text) => !before.has(lyricHash(text)))) {
    return { verified: false, reason: "unchanged" };
  }
  // An older album written in today before its baseline was recorded: what is new can't be
  // told apart from what was there, so nothing is paid until there is a baseline to measure by.
  if (!madeToday && !input.dayBaseline) return { verified: false, reason: "no-baseline" };
  return { verified: true };
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Record today's lyrics baseline for the workspace's albums that haven't been saved today, so
 * their snapshot is still the one from before today. Albums that already have one keep it.
 * Called when the day's challenge is opened; earlier days' baselines are cleared.
 */
export async function recordLyricsBaselines(db: Db, workspaceId: string, now: Date) {
  const dayStart = startOfUtcDay(now);
  const day = dayStart.toISOString().slice(0, 10);
  const albums = await db.album.findMany({
    where: { workspaceId, updatedAt: { lt: dayStart }, lyricsBaselines: { none: { day } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, data: true },
  });
  await db.albumLyricsBaseline.deleteMany({ where: { album: { workspaceId }, day: { lt: day } } });
  if (!albums.length) return;
  await db.albumLyricsBaseline.createMany({
    data: albums.map((album) => ({ albumId: album.id, day, lyricHashes: lyricBaselineHashes(album.data) })),
    skipDuplicates: true,
  });
}

/** Record `data` as the album's lyrics baseline for today, unless it already has one. */
export async function recordLyricsBaseline(db: Db, albumId: string, data: unknown, now: Date) {
  const day = startOfUtcDay(now).toISOString().slice(0, 10);
  await db.albumLyricsBaseline.createMany({
    data: [{ albumId, day, lyricHashes: lyricBaselineHashes(data) }],
    skipDuplicates: true,
  });
}

/** The album's lyrics baseline for today, if one was recorded. */
export async function findLyricsBaseline(db: Db, albumId: string, now: Date) {
  const day = startOfUtcDay(now).toISOString().slice(0, 10);
  const row = await db.albumLyricsBaseline.findUnique({
    where: { albumId_day: { albumId, day } },
    select: { lyricHashes: true },
  });
  if (!row) return null;
  return { lyricHashes: asList(row.lyricHashes).filter((hash): hash is string => typeof hash === "string") };
}

/** What the artist is told when the note is saved without credits, in one plain sentence. */
export function challengeWritingReason(
  reason: ChallengeWritingReason,
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
    case "no-baseline":
      return `Note saved, no credits yet: ${where} was already written in today before the challenge was opened, so today's new lines can't be told apart. Write something new in the Studio, then check again.`;
    case "unchanged":
      return `Note saved, no credits yet: the lyrics on ${where} are the same as before today. Write something new in the Studio, then check again.`;
  }
}
