import type { ChallengeWritingReason } from "@/server/challenge-verification";

// Pure data and wording, no server imports: the Studio's challenge band reads it in the browser.

export type DailyChallenge = {
  key: string;
  /** Sentence case, like every title in the app ("Hook in 10 minutes"). */
  title: string;
  description: string;
  credits: number;
  cta: string;
};

/** The Studio address parameter that pins a challenge above the lyrics (`?challenge=<key>`). */
export const CHALLENGE_PARAM = "challenge";

const CHALLENGES: DailyChallenge[] = [
  {
    key: "hook-in-10",
    title: "Hook in 10 minutes",
    description:
      "Write a chorus hook and a 4-chord loop. Keep it simple enough to remember after one listen.",
    credits: 10,
    cta: "Mark hook drafted",
  },
  {
    key: "verse-twist",
    title: "Verse twist",
    description:
      "Draft a verse that changes meaning in its last line. Bonus points if the rhyme scheme flips.",
    credits: 10,
    cta: "Mark verse drafted",
  },
  {
    key: "bridge-lift",
    title: "Bridge lift",
    description:
      "Add a bridge section that modulates (or at least changes the chord color) before returning home.",
    credits: 12,
    cta: "Mark bridge drafted",
  },
  {
    key: "tempo-lock",
    title: "Tempo lock",
    description:
      "Pick a tempo and commit. Write two sections that feel different without changing BPM.",
    credits: 8,
    cta: "Mark tempo locked",
  },
  {
    key: "theme-thread",
    title: "Theme thread",
    description:
      "Pick one central theme and thread it through 2 tracks with a repeated phrase or motif.",
    credits: 12,
    cta: "Mark motif threaded",
  },
];

export function getUtcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getDailyChallenge(day: string = getUtcDay()): {
  day: string;
  challenge: DailyChallenge;
} {
  const index = CHALLENGES.length ? hashString(day) % CHALLENGES.length : 0;
  return { day, challenge: CHALLENGES[index] ?? CHALLENGES[0]! };
}

export function isKnownChallenge(key: string): boolean {
  return CHALLENGES.some((c) => c.key === key);
}

/** The challenge with this key, whichever day it is for; null for an unknown key. */
export function challengeByKey(key: string | null | undefined): DailyChallenge | null {
  return CHALLENGES.find((c) => c.key === key) ?? null;
}

/**
 * Where "Take the challenge" opens: the track in the Studio, at its lyrics, with the prompt
 * pinned above them. Without a track, the Studio opens where it would.
 */
export function challengeStudioHref(albumId: string, challengeKey: string, trackNumber: number | null) {
  const params = new URLSearchParams();
  if (trackNumber) {
    params.set("song", String(trackNumber));
    params.set("focus", "lyrics");
  }
  params.set(CHALLENGE_PARAM, challengeKey);
  return `/app/albums/${albumId}/studio?${params.toString()}`;
}

/**
 * Why a claim earned nothing yet, in one plain sentence, for a claim made without a note: from
 * the Studio's challenge band ("studio", where the writing is on screen) or the Challenges
 * page ("page"). `challengeWritingReason` words the same reasons for an entry with a note.
 */
export function challengeClaimReason(
  reason: ChallengeWritingReason,
  target: { albumTitle: string; trackNumber: number | null },
  place: "studio" | "page",
): string {
  const where =
    target.trackNumber !== null
      ? `track ${String(target.trackNumber).padStart(2, "0")} of ${target.albumTitle}`
      : target.albumTitle;
  const write = place === "studio" ? "Write" : "Write in the Studio";
  const then = place === "studio" ? "then claim again" : "then check again";
  switch (reason) {
    case "no-lyrics":
      return `No credits yet: ${where} has no written lyrics. ${place === "studio" ? "Write them" : "Write them in the Studio"}, ${then}.`;
    case "not-saved-today":
      return `No credits yet: ${where} hasn't been written in today. ${write} something new, ${then}.`;
    case "no-baseline":
      return `No credits yet: ${where} was already written in today before the challenge was opened, so today's new lines can't be told apart. ${write} something new, ${then}.`;
    case "unchanged":
      return `No credits yet: the lyrics on ${where} are the same as before today. ${write} something new, ${then}.`;
  }
}
