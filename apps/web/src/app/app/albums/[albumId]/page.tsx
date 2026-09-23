import Link from "next/link";
import { getAlbumSongOptions } from "@/server/album-songs";
import { notFound } from "next/navigation";

import { AlbumDangerZone } from "@/components/album-danger-zone";
import { FirstProjectChecklist } from "@/components/first-project-checklist";
import { PublishAlbumButton } from "@/components/publish-album-button";
import { ShareAlbumButton } from "@/components/share-album-button";
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
  title: "Album Details",
  description: "Review album details, songs, sharing, and next steps.",
};

export default async function AlbumDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { albumId } = await params;
  const query = await searchParams;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const prisma = getPrisma();
  const [shareLink, onboarding, references, roughDemos] = await Promise.all([
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
    Promise.resolve(listAlbumRoughDemos(album.data)),
  ]);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const initialShareLink =
    shareLink && !shareLink.revokedAt ? `${appUrl}/share/${shareLink.token}` : null;

  const songs = getAlbumSongOptions(album.data);
  const coherence = analyzeAlbumCoherence(album.data);
  const styleBible = getAlbumStyleBible(album.data);
  const styleSummary = summarizeStyleBible(styleBible, references);
  const demoSummary = summarizeRoughDemos(roughDemos);
  const demoReviewSummary = summarizeRoughDemoReviews(analyzeAlbumRoughDemos(album.data));
  const showOnboarding =
    onboarding.completeCount < onboarding.totalCount || query.welcome === "1";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-ink-3">Project</div>
          <div className="text-2xl font-semibold tracking-tight text-ink">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-ink-2">
            {album.artist ? `by ${album.artist}` : "Artist not set"} · {album.trackCount} tracks
          </div>
          {album.conceptSummary ? (
            <div className="mt-3 max-w-[80ch] text-sm leading-relaxed text-ink-2">
              {album.conceptSummary}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/albums/${album.id}/export`}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Export
          </Link>
          <Link
            href={`/app/albums/${album.id}/studio`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            Studio
          </Link>
          <Link
            href={`/app/albums/${album.id}/bible`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            Bible
          </Link>
          <Link
            href={`/app/albums/${album.id}/inbox`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            Inbox
          </Link>
          <Link
            href={`/app/albums/${album.id}/references`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            References
          </Link>
          <Link
            href={`/app/albums/${album.id}/style`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            Style
          </Link>
          <Link
            href={`/app/albums/${album.id}/demos`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            Demos
          </Link>
          <PublishAlbumButton albumId={album.id} initialPublic={album.isPublic} />
          <ShareAlbumButton albumId={album.id} initialLink={initialShareLink} />
          <Link
            href={`/app/albums/${album.id}/versions`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            History
          </Link>
          <Link
            href="/app/create"
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            New
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-line bg-raised p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-ink-3">Tracklist</div>
              <div className="text-sm font-semibold text-ink">Songs</div>
            </div>
            <div className="text-xs text-ink-2">{songs.length} items</div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            <div className="max-h-[520px] overflow-auto">
              {songs.length ? (
                <ul className="divide-y divide-line">
                  {songs.map((song) => (
                    <li key={`${song.trackNumber}-${song.title}`} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 text-xs tabular-nums text-ink-3">
                          {String(song.trackNumber).padStart(2, "0")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">
                            {song.title}
                          </div>
                          <div className="truncate text-xs text-ink-3">
                            Draft section + chords will appear here.
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-ink-2">
                  No songs found in this project.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          {showOnboarding ? <FirstProjectChecklist summary={onboarding} title={album.title} /> : null}

          <Link
            href={`/app/albums/${album.id}/coherence`}
            className="block rounded-2xl border border-line bg-raised p-4 hover:bg-raised"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Coherence</div>
                <div className="mt-1 text-sm font-semibold text-ink">
                  {coherence.score}/100
                </div>
              </div>
              <div className="rounded-full bg-hover px-3 py-1 text-xs text-ink-2">
                View report
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {coherence.breakdown.map((item) => (
                <div
                  key={item.key}
                  className="rounded-full border border-line bg-sunken px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                >
                  {item.label} {item.score}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-ink-3">
              {coherence.nextActions[0]?.title ??
                coherence.issues[0]?.title ??
                "No issues detected."}
            </div>
          </Link>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Status</div>
            <div className="mt-1 text-sm font-semibold text-ink">{album.status}</div>
            <div className="mt-2 text-xs text-ink-3">
              Updated {album.updatedAt.toLocaleString()}
            </div>
          </div>

          <Link
            href={`/app/albums/${album.id}/references`}
            className="block rounded-2xl border border-line bg-raised p-4 hover:bg-raised"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Reference tracks</div>
                <div className="mt-1 text-sm font-semibold text-ink">
                  {references.length} saved
                </div>
              </div>
              <div className="rounded-full bg-hover px-3 py-1 text-xs text-ink-2">
                Open workspace
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {references.slice(0, 3).map((reference) => (
                <div
                  key={reference.id}
                  className="rounded-full border border-line bg-sunken px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                >
                  {reference.targetRole
                    ? reference.targetRole.replace(/-/g, " ")
                    : reference.songTitle
                      ? `track ${reference.songTrackNumber}`
                      : "album wide"}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-ink-3">
              {references[0]
                ? `${references[0].title}${references[0].artist ? ` · ${references[0].artist}` : ""}`
                : "Capture opener, closer, vocal, and mix references before exporting."}
            </div>
          </Link>

          <Link
            href={`/app/albums/${album.id}/style`}
            className="block rounded-2xl border border-line bg-raised p-4 hover:bg-raised"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Voice / style bible</div>
                <div className="mt-1 text-sm font-semibold text-ink">
                  {styleSummary.score}/100
                </div>
              </div>
              <div className="rounded-full bg-hover px-3 py-1 text-xs text-ink-2">
                Open workspace
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {styleSummary.highlightTags.slice(0, 3).map((item) => (
                <div
                  key={item}
                  className="rounded-full border border-line bg-sunken px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-ink-3">
              {styleBible.lead_voice
                ? styleBible.lead_voice
                : "Define the vocal identity, palette, and mix constraints before export."}
            </div>
          </Link>

          <Link
            href={`/app/albums/${album.id}/demos`}
            className="block rounded-2xl border border-line bg-raised p-4 hover:bg-raised"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Rough demos</div>
                <div className="mt-1 text-sm font-semibold text-ink">
                  {demoSummary.count} captured · {demoReviewSummary.readyCount} ready
                </div>
              </div>
              <div className="rounded-full bg-hover px-3 py-1 text-xs text-ink-2">
                Open workspace
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {demoSummary.sourceKinds.map((item) => (
                <div
                  key={item}
                  className="rounded-full border border-line bg-sunken px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                >
                  {item.replace(/-/g, " ")}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-ink-3">
              {demoReviewSummary.topHeadline
                ? demoReviewSummary.topHeadline
                : demoSummary.latestTitle
                  ? demoSummary.latestTitle
                : "Capture the memo, rehearsal, or riff sketch before it disappears."}
            </div>
          </Link>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Next steps</div>
            <div className="mt-2 space-y-2 text-sm text-ink-2">
              <div>1. Flesh out lyrics per section.</div>
              <div>2. Add chord loops and tempo.</div>
              <div>3. Export a DAW handoff bundle.</div>
            </div>
          </div>

          <AlbumDangerZone albumId={album.id} albumTitle={album.title} />
        </aside>
      </div>
    </div>
  );
}
