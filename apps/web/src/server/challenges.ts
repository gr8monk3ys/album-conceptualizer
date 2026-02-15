export type DailyChallenge = {
  key: string;
  title: string;
  description: string;
  credits: number;
  cta: string;
};

const CHALLENGES: DailyChallenge[] = [
  {
    key: "hook-in-10",
    title: "Hook In 10 Minutes",
    description:
      "Write a chorus hook and a 4-chord loop. Keep it simple enough to remember after one listen.",
    credits: 10,
    cta: "Mark hook drafted",
  },
  {
    key: "verse-twist",
    title: "Verse Twist",
    description:
      "Draft a verse that changes meaning in its last line. Bonus points if the rhyme scheme flips.",
    credits: 10,
    cta: "Mark verse drafted",
  },
  {
    key: "bridge-lift",
    title: "Bridge Lift",
    description:
      "Add a bridge section that modulates (or at least changes the chord color) before returning home.",
    credits: 12,
    cta: "Mark bridge drafted",
  },
  {
    key: "tempo-lock",
    title: "Tempo Lock",
    description:
      "Pick a tempo and commit. Write two sections that feel different without changing BPM.",
    credits: 8,
    cta: "Mark tempo locked",
  },
  {
    key: "theme-thread",
    title: "Theme Thread",
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

export function getChallengeByKey(key: string): DailyChallenge | null {
  return CHALLENGES.find((c) => c.key === key) ?? null;
}

