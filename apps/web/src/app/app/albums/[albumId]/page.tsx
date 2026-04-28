import Link from "next/link";
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

function getSongsFromAlbumData(data: unknown): Array<{ track_number: number; title: string }> {
  if (!data || typeof data !== "object") return [];
  const songs = (data as { songs?: unknown }).songs;
  if (!Array.isArray(songs)) return [];

  return songs
    .map((song) => {
      if (!song || typeof song !== "object") return null;
      const track_number = (song as { track_number?: unknown }).track_number;
      const title = (song as { title?: unknown }).title;
      if (typeof track_number !== "number" || typeof title !== "string") return null;
      return { track_number, title };
    })
    .filter((song): song is { track_number: number; title: string } => Boolean(song))
    .sort((a, b) => a.track_number - b.track_number);
}

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

  const songs = getSongsFromAlbumData(album.data);
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
          <div className="text-xs text-[var(--muted2)]">Project</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {album.artist ? `by ${album.artist}` : "Artist not set"} · {album.trackCount} tracks
          </div>
          {album.conceptSummary ? (
            <div className="mt-3 max-w-[80ch] text-sm leading-relaxed text-[var(--muted)]">
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
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Studio
          </Link>
          <Link
            href={`/app/albums/${album.id}/bible`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Bible
          </Link>
          <Link
            href={`/app/albums/${album.id}/inbox`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Inbox
          </Link>
          <Link
            href={`/app/albums/${album.id}/references`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            References
          </Link>
          <Link
            href={`/app/albums/${album.id}/style`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Style
          </Link>
          <Link
            href={`/app/albums/${album.id}/demos`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Demos
          </Link>
          <PublishAlbumButton albumId={album.id} initialPublic={album.isPublic} />
          <ShareAlbumButton albumId={album.id} initialLink={initialShareLink} />
          <Link
            href={`/app/albums/${album.id}/versions`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            History
          </Link>
          <Link
            href="/app/create"
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            New
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted2)]">Tracklist</div>
              <div className="text-sm font-semibold text-[var(--text)]">Songs</div>
            </div>
            <div className="text-xs text-[var(--muted)]">{songs.length} items</div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
            <div className="max-h-[520px] overflow-auto">
              {songs.length ? (
                <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {songs.map((song) => (
                    <li key={`${song.track_number}-${song.title}`} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 text-xs tabular-nums text-[var(--muted2)]">
                          {String(song.track_number).padStart(2, "0")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">
                            {song.title}
                          </div>
                          <div className="truncate text-xs text-[var(--muted2)]">
                            Draft section + chords will appear here.
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
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
            className="block rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 hover:bg-[rgba(255,255,255,0.05)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Coherence</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                  {coherence.score}/100
                </div>
              </div>
              <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--muted)]">
                View report
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {coherence.breakdown.map((item) => (
                <div
                  key={item.key}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]"
                >
                  {item.label} {item.score}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-[var(--muted2)]">
              {coherence.nextActions[0]?.title ??
                coherence.issues[0]?.title ??
                "No issues detected."}
            </div>
          </Link>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Status</div>
            <div className="mt-1 text-sm font-semibold text-[var(--text)]">{album.status}</div>
            <div className="mt-2 text-xs text-[var(--muted2)]">
              Updated {album.updatedAt.toLocaleString()}
            </div>
          </div>

          <Link
            href={`/app/albums/${album.id}/references`}
            className="block rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 hover:bg-[rgba(255,255,255,0.05)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Reference tracks</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                  {references.length} saved
                </div>
              </div>
              <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--muted)]">
                Open workspace
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {references.slice(0, 3).map((reference) => (
                <div
                  key={reference.id}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]"
                >
                  {reference.targetRole
                    ? reference.targetRole.replace(/-/g, " ")
                    : reference.songTitle
                      ? `track ${reference.songTrackNumber}`
                      : "album wide"}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-[var(--muted2)]">
              {references[0]
                ? `${references[0].title}${references[0].artist ? ` · ${references[0].artist}` : ""}`
                : "Capture opener, closer, vocal, and mix references before exporting."}
            </div>
          </Link>

          <Link
            href={`/app/albums/${album.id}/style`}
            className="block rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 hover:bg-[rgba(255,255,255,0.05)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Voice / style bible</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                  {styleSummary.score}/100
                </div>
              </div>
              <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--muted)]">
                Open workspace
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {styleSummary.highlightTags.slice(0, 3).map((item) => (
                <div
                  key={item}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-[var(--muted2)]">
              {styleBible.lead_voice
                ? styleBible.lead_voice
                : "Define the vocal identity, palette, and mix constraints before export."}
            </div>
          </Link>

          <Link
            href={`/app/albums/${album.id}/demos`}
            className="block rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 hover:bg-[rgba(255,255,255,0.05)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Rough demos</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                  {demoSummary.count} captured · {demoReviewSummary.readyCount} ready
                </div>
              </div>
              <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--muted)]">
                Open workspace
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {demoSummary.sourceKinds.map((item) => (
                <div
                  key={item}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]"
                >
                  {item.replace(/-/g, " ")}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-[var(--muted2)]">
              {demoReviewSummary.topHeadline
                ? demoReviewSummary.topHeadline
                : demoSummary.latestTitle
                  ? demoSummary.latestTitle
                : "Capture the memo, rehearsal, or riff sketch before it disappears."}
            </div>
          </Link>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Next steps</div>
            <div className="mt-2 space-y-2 text-sm text-[var(--muted)]">
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
