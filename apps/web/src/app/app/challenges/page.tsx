import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { PageHeader, Section } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { getAlbumSongOptions } from "@/server/album-songs";
import { getDailyChallenge } from "@/server/challenges";
import { getPrisma } from "@/server/db";
import { getAgentAvailability } from "@/server/engine";
import { requireUser } from "@/server/identity";
import { effectivePlan, planMonthlyCredits } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Challenges",
  description: "A short songwriting prompt each day. Writing it into an album earns workspace credits.",
};

const PLAN_NAME = { free: "Free", pro: "Pro", team: "Team" } as const;

const CREDIT_USES: Array<{ label: string; cost: number; ai?: boolean }> = [
  { label: "Create an album", cost: CREDIT_COSTS.albumCreate },
  { label: "Remix an album from Discover", cost: CREDIT_COSTS.albumFork },
  { label: "Download the zip export", cost: CREDIT_COSTS.exportZip },
  { label: "An AI draft (ideas, a track or a written review)", cost: CREDIT_COSTS.agentRun, ai: true },
];

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

export default async function ChallengesPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = effectivePlan(workspace.subscription);
  const prisma = getPrisma();

  const { day, challenge } = getDailyChallenge();

  const [completion, albums, aiAvailable] = await Promise.all([
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
    // For the "Written in" choice, and to link a finished entry back to its album.
    prisma.album.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, data: true },
    }),
    // AI drafts aren't offered as a way to spend credits when the server can't run them.
    getAgentAvailability(),
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
        description="One short writing prompt a day, the same for everyone. Write against it in one of your albums, then note what you drafted and where. The credits come once that album shows lyrics written today (UTC). A new prompt arrives at 00:00 UTC."
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
            albums={albums.map((album) => ({
              id: album.id,
              title: album.title,
              tracks: getAlbumSongOptions(album.data).map((song) => ({
                number: song.trackNumber,
                title: song.title,
              })),
            }))}
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
              description={`Some actions spend credits. Each calendar month your ${PLAN_NAME[plan]} plan tops your balance up to ${planMonthlyCredits(plan)}; credits earned here are kept on top of that.`}
            >
              <dl className="border-t border-line">
                {CREDIT_USES.map((use) => (
                  <div
                    key={use.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line py-2"
                  >
                    <dt className="min-w-0 text-sm text-ink-2">{use.label}</dt>
                    {use.ai && !aiAvailable ? (
                      <dd className="text-sm text-ink-3">Not available on this server right now</dd>
                    ) : (
                      <dd className="type-figure text-sm font-semibold text-ink">
                        {use.cost} credits
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
              <p className="mt-3 max-w-[65ch] text-sm text-ink-3">Writing, saving, the Album Bible and the Coherence report never cost credits.</p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
