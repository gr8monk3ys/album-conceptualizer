import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AlbumDangerZone } from "@/components/album-danger-zone";
import { FirstProjectChecklist } from "@/components/first-project-checklist";
import { PublishAlbumButton } from "@/components/publish-album-button";
import { ShareAlbumButton } from "@/components/share-album-button";
import { ButtonLink, Section, buttonClass } from "@/components/ui";
import { nextAlbumStep } from "@/server/album-songs";
import { getAlbum } from "@/server/albums";
import { analyzeAlbumCoherence } from "@/server/coherence";
import { getPrisma } from "@/server/db";
import { listAlbumReferences } from "@/server/references";
import { requireUser } from "@/server/identity";
import { getAlbumOnboardingSummary } from "@/server/onboarding";
import { analyzeAlbumRoughDemos, summarizeRoughDemoReviews } from "@/server/rough-demo-review";
import { listAlbumRoughDemos, summarizeRoughDemos } from "@/server/rough-demos";
import { getAlbumStyleBible, summarizeStyleBible } from "@/server/style-bible";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album overview",
  description: "What the album needs next, how it holds together, its sound and how it's released.",
};

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function humanize(value: string) {
  const text = value.replace(/[-_]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function verdict(score: number) {
  if (score >= 85) return "Tight";
  if (score >= 70) return "Solid";
  if (score >= 50) return "Needs polish";
  return "Loose";
}

/** One row that opens a screen: a name, a figure and the latest detail. */
function StatusRow({
  href,
  label,
  figure,
  detail,
  trailing,
}: {
  href: string;
  label: string;
  figure: string;
  detail: string;
  /** Visible words before the arrow, when the row needs to say where it goes. */
  trailing?: string;
}) {
  return (
    <li>
      <Link href={href} className="group flex min-h-11 items-start gap-4 py-3 pr-1 transition-colors hover:bg-hover">
        <span className="min-w-0 flex-1 sm:flex sm:gap-4">
          <span className="block text-sm font-semibold text-ink sm:min-w-0 sm:shrink sm:basis-48">{label}</span>
          <span className="mt-1 block min-w-0 flex-1 sm:mt-0">
            <span className="type-figure block text-sm text-ink">{figure}</span>
            <span className="mt-0.5 block max-w-[65ch] break-words text-xs leading-relaxed text-ink-3">{detail}</span>
          </span>
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-ink-2 group-hover:text-ink">
          {trailing ? <span className="font-semibold">{trailing}</span> : null}
          <ArrowRight
            className="h-4 w-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink motion-safe:transition-[color,transform] motion-safe:group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

export default async function AlbumOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { albumId } = await params;
  const { welcome } = await searchParams;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const prisma = getPrisma();
  const [shareLink, onboarding, references, openComments, openTasks] = await Promise.all([
    prisma.albumShareLink.findUnique({
      where: { albumId: album.id },
      select: { token: true, revokedAt: true },
    }),
    getAlbumOnboardingSummary({
      workspaceId: workspace.id,
      albumId: album.id,
      data: album.data,
      isPublic: album.isPublic,
    }),
    listAlbumReferences(workspace.id, album.id),
    prisma.albumSectionComment.count({ where: { albumId: album.id, deletedAt: null, resolvedAt: null } }),
    prisma.albumTask.count({ where: { albumId: album.id, deletedAt: null, status: { not: "done" } } }),
  ]);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const initialShareLink =
    shareLink && !shareLink.revokedAt ? `${appUrl}/share/${shareLink.token}` : null;

  const base = `/app/albums/${album.id}`;
  const step = nextAlbumStep(album.id, album.data);
  const coherence = analyzeAlbumCoherence(album.data);
  const weakest = coherence.breakdown.reduce((low, item) => (item.score < low.score ? item : low));
  const styleBible = getAlbumStyleBible(album.data);
  const styleSummary = summarizeStyleBible(styleBible, references);
  const roughDemos = listAlbumRoughDemos(album.data);
  const demoSummary = summarizeRoughDemos(roughDemos);
  const demoReviewSummary = summarizeRoughDemoReviews(analyzeAlbumRoughDemos(album.data));
  const firstReference = references[0];

  return (
    <div className="flex flex-col gap-10">
      {welcome === "1" ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded border border-line bg-raised px-4 py-3">
          <p className="min-w-0 max-w-[65ch] break-words text-sm text-ink">
            <span className="font-semibold">{album.title}</span> is saved. Next:{" "}
            {step.action.charAt(0).toLowerCase() + step.action.slice(1)}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={step.href} tone="primary">
              {step.action}
            </ButtonLink>
            <Link href={base} className={buttonClass("ghost")}>
              Dismiss
            </Link>
          </div>
        </div>
      ) : null}

      <Section id="album-next" title="What's next" description="The path from a blueprint to a handoff pack.">
        <FirstProjectChecklist summary={onboarding} />
      </Section>

      <Section id="album-status" title="Where it stands">
        <ul className="divide-y divide-line border-y border-line">
          <StatusRow
            href={`${base}/coherence`}
            label="Coherence"
            figure={coherence.insufficient ? "Not scored yet" : `${coherence.score}/100 · ${verdict(coherence.score)}`}
            detail={
              coherence.insufficient
                ? coherence.summary
                : coherence.issues.length
                  ? `Weakest area: ${weakest.label}. ${plural(coherence.issues.length, "finding")} to work through.`
                  : "No open findings. The tracks hold together on this draft."
            }
            trailing="View report"
          />
          <StatusRow
            href={`${base}/style`}
            label="Voice / style bible"
            figure={`${styleSummary.filledCount} of ${styleSummary.totalCount} set`}
            detail={styleBible.lead_voice || "Define the vocal identity, palette and mix limits before export."}
          />
          <StatusRow
            href={`${base}/references`}
            label="Reference tracks"
            figure={plural(references.length, "saved", "saved")}
            detail={
              firstReference
                ? `${firstReference.title}${firstReference.artist ? ` · ${firstReference.artist}` : ""}`
                : "Pin down the opener, closer, vocal and mix references before exporting."
            }
          />
          <StatusRow
            href={`${base}/demos`}
            label="Rough demos"
            figure={`${demoSummary.count} captured · ${demoReviewSummary.readyCount} ready`}
            detail={
              demoReviewSummary.topHeadline ??
              (demoSummary.latestTitle
                ? demoSummary.latestTitle
                : demoSummary.sourceKinds.length
                  ? demoSummary.sourceKinds.map(humanize).join(", ")
                  : "Capture the memo, rehearsal or riff sketch before it disappears.")
            }
          />
          <StatusRow
            href={`${base}/inbox`}
            label="Comments and tasks"
            figure={`${plural(openComments, "open comment")} · ${plural(openTasks, "open task")}`}
            detail={
              openComments || openTasks
                ? "Resolve notes left on sections and close the tasks that are done."
                : "Nothing waiting. Comments left on sections and tasks show up here."
            }
          />
        </ul>
      </Section>

      <Section
        id="album-release"
        title="Release"
        description="Publish to Discover for others to find and remix, or send a private link."
      >
        <div className="flex flex-col gap-6">
          <PublishAlbumButton albumId={album.id} initialPublic={album.isPublic} />
          <ShareAlbumButton albumId={album.id} initialLink={initialShareLink} />
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={`${base}/versions`}>Version history</ButtonLink>
            <p className="min-w-0 max-w-[65ch] text-sm text-ink-2">Save a version before a big rewrite, or restore one.</p>
          </div>
        </div>
      </Section>

      <AlbumDangerZone albumId={album.id} albumTitle={album.title} />
    </div>
  );
}
