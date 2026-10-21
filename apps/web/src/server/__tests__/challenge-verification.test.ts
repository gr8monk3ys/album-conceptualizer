import { describe, expect, it } from "vitest";

import {
  challengeWritingReason,
  checkChallengeWriting,
  lyricBaselineHashes,
  startOfUtcDay,
  writtenLyricTexts,
} from "@/server/challenge-verification";

const NOW = new Date("2026-09-26T15:00:00Z");
const TODAY = new Date("2026-09-26T09:00:00Z");
const LAST_WEEK = new Date("2026-09-19T09:00:00Z");

function album(songs: Array<{ track: number; lyrics: Array<string | null> }>, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    songs: songs.map((song) => ({
      track_number: song.track,
      title: `Track ${song.track}`,
      sections: song.lyrics.map((lyrics, order) => ({ section_type: "verse", order, lyrics })),
    })),
  };
}

describe("writtenLyricTexts", () => {
  it("keeps written sections only, normalised, for one track or the album", () => {
    const data = album([
      { track: 1, lyrics: ["[Verse 1]", "Salt  on the\nglass"] },
      { track: 2, lyrics: ["Low tide"] },
    ]);
    expect(writtenLyricTexts(data, 1)).toEqual(["salt on the glass"]);
    expect(writtenLyricTexts(data)).toEqual(["salt on the glass", "low tide"]);
    expect(writtenLyricTexts(data, 3)).toEqual([]);
    expect(writtenLyricTexts(null)).toEqual([]);
  });
});

describe("startOfUtcDay", () => {
  it("is midnight UTC of the same day", () => {
    expect(startOfUtcDay(NOW).toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });
});

describe("checkChallengeWriting", () => {
  it("pays for a track written today in an album made today", () => {
    const data = album([{ track: 1, lyrics: ["Salt on the glass"] }]);
    expect(
      checkChallengeWriting({
        now: NOW,
        album: { data, createdAt: TODAY, updatedAt: TODAY },
        trackNumber: 1,
        dayBaseline: null,
        versionBeforeToday: null,
        firstVersion: null,
      }),
    ).toEqual({ verified: true });
  });

  it("refuses a linked track without written lyrics (placeholders don't count)", () => {
    const data = album([
      { track: 1, lyrics: ["[Write the verse]"] },
      { track: 2, lyrics: ["Low tide"] },
    ]);
    expect(
      checkChallengeWriting({
        now: NOW,
        album: { data, createdAt: TODAY, updatedAt: TODAY },
        trackNumber: 1,
        dayBaseline: null,
        versionBeforeToday: null,
        firstVersion: null,
      }),
    ).toEqual({ verified: false, reason: "no-lyrics" });
  });

  it("refuses an album not saved today", () => {
    const data = album([{ track: 1, lyrics: ["Salt on the glass"] }]);
    expect(
      checkChallengeWriting({
        now: NOW,
        album: { data, createdAt: LAST_WEEK, updatedAt: new Date("2026-09-25T23:59:00Z") },
        trackNumber: null,
        dayBaseline: null,
        versionBeforeToday: null,
        firstVersion: null,
      }),
    ).toEqual({ verified: false, reason: "not-saved-today" });
  });

  it("refuses lyrics that are the same as the last version before today", () => {
    const before = album([{ track: 1, lyrics: ["Salt on the glass"] }]);
    const now = album([{ track: 1, lyrics: ["salt on the   glass"] }]);
    expect(
      checkChallengeWriting({
        now: NOW,
        album: { data: now, createdAt: LAST_WEEK, updatedAt: TODAY },
        trackNumber: 1,
        dayBaseline: null,
        versionBeforeToday: { data: before },
        firstVersion: { data: before },
      }),
    ).toEqual({ verified: false, reason: "unchanged" });
  });

  it("pays for a new section only against today's baseline, not an older version alone", () => {
    const before = album([{ track: 1, lyrics: ["Salt on the glass", null] }]);
    const now = album([{ track: 1, lyrics: ["Salt on the glass", "The keeper counts the ships"] }]);
    const input = {
      now: NOW,
      album: { data: now, createdAt: LAST_WEEK, updatedAt: TODAY },
      trackNumber: 1,
      dayBaseline: null,
      versionBeforeToday: { data: before },
      firstVersion: { data: before },
    };
    // The version may be weeks old: the new section could have been written any day since.
    expect(checkChallengeWriting(input)).toEqual({ verified: false, reason: "no-baseline" });
    expect(
      checkChallengeWriting({ ...input, dayBaseline: { lyricHashes: lyricBaselineHashes(before) } }),
    ).toEqual({ verified: true });
  });

  it("doesn't count a verse moved from another track as new writing", () => {
    const before = album([
      { track: 1, lyrics: [null] },
      { track: 2, lyrics: ["Low tide"] },
    ]);
    const now = album([
      { track: 1, lyrics: ["Low tide"] },
      { track: 2, lyrics: [null] },
    ]);
    expect(
      checkChallengeWriting({
        now: NOW,
        album: { data: now, createdAt: LAST_WEEK, updatedAt: TODAY },
        trackNumber: 1,
        dayBaseline: null,
        versionBeforeToday: { data: before },
        firstVersion: null,
      }),
    ).toEqual({ verified: false, reason: "unchanged" });
  });

  it("measures a remix made today from the copy it started as", () => {
    const copy = album([{ track: 1, lyrics: ["Their verse"] }], { remixed_from: { title: "Salt Year" } });
    const input = {
      now: NOW,
      album: { data: copy, createdAt: TODAY, updatedAt: TODAY },
      trackNumber: 1,
      dayBaseline: null,
      versionBeforeToday: null,
      firstVersion: { data: copy },
    };
    expect(checkChallengeWriting(input)).toEqual({ verified: false, reason: "unchanged" });

    const rewritten = album([{ track: 1, lyrics: ["My verse"] }], { remixed_from: { title: "Salt Year" } });
    expect(checkChallengeWriting({ ...input, album: { ...input.album, data: rewritten } })).toEqual({
      verified: true,
    });
  });

  it("doesn't pay an older album saved today when there is no baseline to measure by", () => {
    const data = album([{ track: 1, lyrics: ["Salt on the glass"] }]);
    expect(
      checkChallengeWriting({
        now: NOW,
        album: { data, createdAt: LAST_WEEK, updatedAt: TODAY },
        trackNumber: null,
        dayBaseline: null,
        versionBeforeToday: null,
        firstVersion: null,
      }),
    ).toEqual({ verified: false, reason: "no-baseline" });
  });

  it("measures an older album against today's baseline", () => {
    const before = album([{ track: 1, lyrics: ["Salt on the glass"] }]);
    const input = {
      now: NOW,
      album: { data: before, createdAt: LAST_WEEK, updatedAt: TODAY },
      trackNumber: 1,
      dayBaseline: { lyricHashes: lyricBaselineHashes(before) },
      versionBeforeToday: null,
      firstVersion: null,
    };
    expect(checkChallengeWriting(input)).toEqual({ verified: false, reason: "unchanged" });

    const grown = album([{ track: 1, lyrics: ["Salt on the glass", "The keeper counts the ships"] }]);
    expect(checkChallengeWriting({ ...input, album: { ...input.album, data: grown } })).toEqual({
      verified: true,
    });
  });

  it("doesn't count lyrics restored from the last version before today", () => {
    const version = album([{ track: 1, lyrics: ["Low tide"] }]);
    const baseline = album([{ track: 1, lyrics: [null] }]);
    const restored = album([{ track: 1, lyrics: ["Low tide"] }]);
    expect(
      checkChallengeWriting({
        now: NOW,
        album: { data: restored, createdAt: LAST_WEEK, updatedAt: TODAY },
        trackNumber: 1,
        dayBaseline: { lyricHashes: lyricBaselineHashes(baseline) },
        versionBeforeToday: { data: version },
        firstVersion: null,
      }),
    ).toEqual({ verified: false, reason: "unchanged" });
  });
});

describe("challengeWritingReason", () => {
  it("names the track and says what to do", () => {
    expect(challengeWritingReason("no-lyrics", { albumTitle: "Salt Year", trackNumber: 3 })).toBe(
      "Note saved, no credits yet: track 03 of Salt Year has no written lyrics. Write them in the Studio, then check again.",
    );
    expect(challengeWritingReason("unchanged", { albumTitle: "Salt Year", trackNumber: null })).toMatch(
      /^Note saved, no credits yet: the lyrics on Salt Year are the same as before today/,
    );
  });
});
