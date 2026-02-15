import Link from "next/link";

import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { getPrisma } from "@/server/db";
import { getDailyChallenge } from "@/server/challenges";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

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
  const prisma = getPrisma();

  const { day, challenge } = getDailyChallenge();

  const completion = await prisma.challengeCompletion.findFirst({
    where: {
      workspaceId: workspace.id,
      challengeKey: challenge.key,
      challengeDay: day,
    },
    select: {
      id: true,
      notes: true,
      creditsEarned: true,
      createdAt: true,
    },
  });

  const since = addDaysUtc(day, -30);
  const recentCompletions = await prisma.challengeCompletion.findMany({
    where: {
      workspaceId: workspace.id,
      challengeDay: { gte: since },
    },
    orderBy: { challengeDay: "desc" },
    select: { challengeDay: true, creditsEarned: true },
  });

  const completedDays = new Set(recentCompletions.map((row) => row.challengeDay));
  const streak = computeStreak(day, completedDays);
  const earnedLast30 = recentCompletions.reduce((sum, row) => sum + (row.creditsEarned ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Challenges</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Earn credits by writing daily
          </div>
          <div className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
            Tiny prompts that push you forward. Credits can be spent on exports and project
            creation.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/studio"
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Open Studio
          </Link>
          <Link
            href="/app/create"
            className="rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-5 py-3 text-sm font-semibold text-black hover:brightness-110"
          >
            New project
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <DailyChallengeCard
          day={day}
          challenge={challenge}
          completed={Boolean(completion)}
          completionNote={completion?.notes ?? null}
          completionTime={completion?.createdAt?.toISOString() ?? null}
        />

        <aside className="space-y-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Streak</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{streak} days</div>
            <div className="mt-2 text-xs text-[var(--muted2)]">
              Based on completions in the last 30 days (UTC day boundaries).
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Earned (30d)</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text)]">
              +{earnedLast30} credits
            </div>
            <div className="mt-2 text-xs text-[var(--muted2)]">
              Complete today&apos;s prompt to keep momentum.
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">How it works</div>
            <div className="mt-2 space-y-2 text-sm text-[var(--muted)]">
              <div>1. Draft a section in Studio.</div>
              <div>2. Mark the challenge complete with a quick note.</div>
              <div>3. Spend credits on exports and new projects.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

