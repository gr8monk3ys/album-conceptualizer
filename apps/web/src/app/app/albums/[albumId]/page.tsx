import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AlbumDangerZone } from "@/components/album-danger-zone";
import { FirstProjectChecklist } from "@/components/first-project-checklist";
import { PublishAlbumButton } from "@/components/publish-album-button";
import { ShareAlbumButton } from "@/components/share-album-button";
import { ButtonLink, EmptyState, Section } from "@/components/ui";
import { getSpineRows } from "@/server/album-songs";
import { getAlbum } from "@/server/albums";
import { analyzeAlbumCoherence, coherenceFixHref } from "@/server/coherence";
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
  description: "The album's tracklist, what to do next, its coherence and how it's released.",
};

type TrackMeta = { key: string | null; tempo: number | null };

/** Key and tempo per track number, read straight from the album snapshot. */
function trackMeta(data: unknown) {
  const meta = new Map<number, TrackMeta>();
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!Array.isArray(songs)) return meta;
  for (const raw of songs) {
    if (!raw || typeof raw !== "object") continue;
    const song = raw as { track_number?: unknown; key?: unknown; tempo?: unknown };
    if (typeof song.track_number !== "number") continue;
    meta.set(song.track_number, {
      key: typeof song.key === "string" && song.key.trim() ? song.key.trim() : null,
      tempo: typeof song.tempo === "number" && song.tempo > 0 ? song.tempo : null,
    });
  }
  return meta;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function humanize(value: string) {
  const text = value.replace(/[-_]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One compact row that opens a workspace: a name, a figure and the latest detail. */
function WorkspaceRow({
  href,
  label,
  figure,
  detail,
}: {
  href: string;
  label: string;
  figure: string;
  detail: string;
}) {
  return (
    <li>
      <Link href={href} className="group flex min-h-11 items-start gap-4 py-3 pr-1 transition-colors hover:bg-hover">
        <span className="min-w-0 flex-1 sm:flex sm:gap-4">
          <span className="block text-sm font-semibold text-ink sm:w-48 sm:shrink-0">{label}</span>
          <span className="mt-1 block min-w-0 flex-1 sm:mt-0">
            <span className="type-figure block text-sm text-ink">{figure}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-3">{detail}</span>
          </span>
        </span>
        <ArrowRight
          className="mt-0.5 h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export default async function AlbumOverviewPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const prisma = getPrisma();
  const [shareLink, onboarding, references] = await Promise.all([
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
  ]);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const initialShareLink =
    shareLink && !shareLink.revokedAt ? `${appUrl}/share/${shareLink.token}` : null;

  const base = `/app/albums/${album.id}`;
  const rows = getSpineRows(album.data);
  const meta = trackMeta(album.data);
  const coherence = analyzeAlbumCoherence(album.data);
  const topAction = coherence.nextActions[0] ?? null;
  const styleBible = getAlbumStyleBible(album.data);
  const styleSummary = summarizeStyleBible(styleBible, references);
  const roughDemos = listAlbumRoughDemos(album.data);
  const demoSummary = summarizeRoughDemos(roughDemos);
  const demoReviewSummary = summarizeRoughDemoReviews(analyzeAlbumRoughDemos(album.data));
  const firstReference = references[0];

  return (
    <div className="flex flex-col gap-10">
      {album.conceptSummary ? (
        <p className="max-w-[68ch] text-base leading-relaxed text-ink-2">{album.conceptSummary}</p>
      ) : null}

      {/* On xl screens the layout's spine already shows the sequence. */}
      <Section
        id="album-tracklist"
        title="Tracklist"
        description="Open a track to write it in the Studio."
        className="xl:hidden"
      >
        {rows.length ? (
          <ol className="divide-y divide-line border-y border-line">
            {rows.map((row) => {
              const { key, tempo } = meta.get(row.trackNumber) ?? { key: null, tempo: null };
              const subtitle = [
                plural(row.sections, "section"),
                key,
                tempo ? `${tempo} bpm` : null,
                row.sections ? `lyrics ${row.lyricSections}/${row.sections}` : "no lyrics yet",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={row.trackNumber}>
                  <Link
                    href={`${base}/studio?song=${row.trackNumber}`}
                    className="group flex min-h-11 items-center gap-4 py-2.5 pr-1 transition-colors hover:bg-hover"
                  >
                    <span className="type-figure w-8 shrink-0 text-xl font-semibold text-ink-3 group-hover:text-accent">
                      {String(row.trackNumber).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{row.title}</span>
                      <span className="type-figure block truncate text-xs text-ink-3">{subtitle}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState
            title="No tracks yet"
            action={
              <ButtonLink href={`${base}/studio`} tone="primary">
                Add the first track
              </ButtonLink>
            }
          >
            Start the sequence in the Studio: name the opener, then build the arc from there.
          </EmptyState>
        )}
      </Section>

      <Section id="album-next" title="What's next" description="The path from a blueprint to a handoff.">
        <FirstProjectChecklist summary={onboarding} />
      </Section>

      <Section
        id="album-coherence"
        title="Coherence"
        actions={<ButtonLink href={`${base}/coherence`}>View report</ButtonLink>}
      >
        {coherence.insufficient ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">{coherence.summary}</p>
            {coherence.missing.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {coherence.missing.map((piece) => (
                  <li key={piece.id}>
                    <Link
                      href={coherenceFixHref(album.id, piece.fix)}
                      className="inline-flex min-h-11 items-center gap-2 text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink-3"
                    >
                      {piece.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <p className="type-figure text-4xl font-semibold text-ink">
              {coherence.score}
              <span className="text-base font-normal text-ink-3">/100</span>
            </p>
            <div className="min-w-0 flex-1 basis-64">
              {topAction ? (
                <>
                  <p className="text-xs text-ink-3">Top next action</p>
                  <Link
                    href={coherenceFixHref(album.id, topAction.fix)}
                    className="mt-0.5 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
                  >
                    {topAction.title}
                  </Link>
                  <p className="text-sm leading-relaxed text-ink-2">{topAction.detail}</p>
                </>
              ) : (
                <p className="text-sm text-ink-2">No open issues. The tracks hold together on this draft.</p>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section id="album-materials" title="References, style and demos">
        <ul className="divide-y divide-line border-y border-line">
          <WorkspaceRow
            href={`${base}/references`}
            label="Reference tracks"
            figure={plural(references.length, "saved", "saved")}
            detail={
              firstReference
                ? `${firstReference.title}${firstReference.artist ? ` · ${firstReference.artist}` : ""}`
                : "Pin down the opener, closer, vocal and mix references before exporting."
            }
          />
          <WorkspaceRow
            href={`${base}/style`}
            label="Voice / style bible"
            figure={`${styleSummary.filledCount} of ${styleSummary.totalCount} set`}
            detail={styleBible.lead_voice || "Define the vocal identity, palette and mix limits before export."}
          />
          <WorkspaceRow
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
            <ButtonLink href={`${base}/versions`}>
              Version history
            </ButtonLink>
            <p className="min-w-0 text-sm text-ink-2">Save a snapshot before a big rewrite, or restore one.</p>
          </div>
        </div>
      </Section>

      <AlbumDangerZone albumId={album.id} albumTitle={album.title} />
    </div>
  );
}
