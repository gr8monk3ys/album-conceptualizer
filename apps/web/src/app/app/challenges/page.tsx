import Link from "next/link";

import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { PageHeader, Section } from "@/components/ui";
import { trackHasLyrics } from "@/lib/lyrics";
import { asList } from "@/lib/snapshot-values";
import { getAlbumSongOptions } from "@/server/album-songs";
import { recordLyricsBaselines } from "@/server/challenge-verification";
import { getDailyChallenge } from "@/server/challenges";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { effectivePlan, planMonthlyCredits } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Challenges",
  description: "A short songwriting prompt each day. Writing it into an album earns workspace credits.",
};

const PLAN_NAME = { free: "Free", pro: "Pro", team: "Team" } as const;

function addDaysUtc(day: string, delta: number) {
  const [y, m, d] = day.split("-").map((v) => Number(v));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function computeStreak(today: string, completedDays: Set<string>) {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const day = addDaysUtc(today, -i);
    if (!completedDays.has(day)) break;
    streak += 1;
  }
  return streak;
}

/** The track numbers that already have written lyrics, so the prompt suggests a fresh one. */
function writtenTracks(data: unknown): Set<number> {
  const songs = asList((data as { songs?: unknown } | null)?.songs);
  const written = new Set<number>();
  for (const song of songs) {
    const raw = song as { track_number?: unknown; sections?: unknown } | null;
    if (typeof raw?.track_number === "number" && trackHasLyrics(raw.sections)) written.add(raw.track_number);
  }
  return written;
}

export default async function ChallengesPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = effectivePlan(workspace.subscription);
  const prisma = getPrisma();

  const now = new Date();
  const { day, challenge } = getDailyChallenge();

  // Opening the challenge records where each album's lyrics stand before today's writing, so
  // the entry's credits are paid for what is written after (see challenge-verification).
  await recordLyricsBaselines(prisma, workspace.id, now);

  const [completion, albums] = await Promise.all([
    prisma.challengeCompletion.findFirst({
      where: {
        workspaceId: workspace.id,
        challengeKey: challenge.key,
        challengeDay: day,
      },
      select: {
        id: true,
        notes: true,
        albumId: true,
        trackNumber: true,
        creditsEarned: true,
        createdAt: true,
      },
    }),
    // For the "Write it in" choice, and to link a finished entry back to its album.
    prisma.album.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, data: true },
    }),
  ]);
  const completionLink = completion?.albumId
    ? { albumId: completion.albumId, trackNumber: completion.trackNumber }
    : null;

  const since = addDaysUtc(day, -30);
  const recentCompletions = await prisma.challengeCompletion.findMany({
    where: {
      workspaceId: workspace.id,
      challengeDay: { gte: since },
      // A note saved without credits (the writing didn't show) doesn't count toward the run.
      creditsEarned: { gt: 0 },
    },
    orderBy: { challengeDay: "desc" },
    select: { challengeDay: true, creditsEarned: true },
  });

  const completedDays = new Set(recentCompletions.map((row) => row.challengeDay));
  const streak = computeStreak(day, completedDays);
  const earned = recentCompletions.reduce((sum, row) => sum + (row.creditsEarned ?? 0), 0);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Challenges"
        size="page"
        description="One short writing prompt a day, the same for everyone. Take it into one of your tracks: the Studio keeps the prompt above the lyrics, and the credits come once the track shows lyrics written today."
      />

      {/* Rem-sized container query: with enlarged text the side column folds under the prompt. */}
      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <DailyChallengeCard
            day={day}
            challenge={challenge}
            completion={
              completion
                ? {
                    note: completion.notes ?? "",
                    link: completionLink,
                    time: completion.createdAt.toISOString(),
                    creditsEarned: completion.creditsEarned,
                  }
                : null
            }
            albums={albums.map((album) => {
              const written = writtenTracks(album.data);
              return {
                id: album.id,
                title: album.title,
                tracks: getAlbumSongOptions(album.data).map((song) => ({
                  number: song.trackNumber,
                  title: song.title,
                  written: written.has(song.trackNumber),
                })),
              };
            })}
          />

          <div className="flex min-w-0 flex-col gap-8">
            <Section title="Your run">
              <dl className="grid grid-cols-2 divide-x divide-line">
                <div className="pr-4">
                  <dt className="type-catalog text-xs text-ink-2">Streak</dt>
                  <dd className="type-figure mt-1 text-3xl font-semibold text-ink">{streak}</dd>
                  <dd className="text-xs text-ink-3">{streak === 1 ? "day" : "days"} in a row</dd>
                </div>
                <div className="pl-4">
                  <dt className="type-catalog text-xs text-ink-2">Earned</dt>
                  <dd className="type-figure mt-1 text-3xl font-semibold text-ink">{earned}</dd>
                  <dd className="text-xs text-ink-3">credits, past 30 days</dd>
                </div>
              </dl>
            </Section>

            <Section
              title="What credits are for"
              description={`Some actions spend credits. Each calendar month your ${PLAN_NAME[plan]} plan tops your balance up to ${planMonthlyCredits(plan)}; credits earned here are kept on top of that. Writing, saving, the Story bible and the Coherence report never cost credits.`}
            >
              <Link
                href="/app/settings/billing#credits-title"
                className="inline-flex min-h-11 items-center text-sm text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
              >
                What each action costs, on every plan
              </Link>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
