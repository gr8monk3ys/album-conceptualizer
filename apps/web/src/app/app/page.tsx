import { AlbumCard, type AlbumListItem } from "@/components/album-card";
import { WorkspaceFunnelCard } from "@/components/workspace-funnel-card";
import Link from "next/link";

import { listAlbums } from "@/server/albums";
import { getWorkspaceFunnelSummary } from "@/server/analytics";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Workspace Home",
  description: "Track album progress, recent projects, and next actions in one view.",
};

function buildSubtitle(input: {
  primaryGenre: string | null;
  trackCount: number;
  conceptSummary: string | null;
}) {
  const genre = input.primaryGenre || "Concept";
  const tracks = `${input.trackCount} track${input.trackCount === 1 ? "" : "s"}`;
  const summary = input.conceptSummary ? ` | ${input.conceptSummary}` : "";
  return `${genre} | ${tracks}${summary}`;
}

export default async function AppHomePage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const [albums, funnel] = await Promise.all([
    listAlbums(workspace.id),
    getWorkspaceFunnelSummary(workspace.id),
  ]);

  const items: AlbumListItem[] = albums.map((album) => ({
    id: album.id,
    title: album.title,
    subtitle: buildSubtitle({
      primaryGenre: album.primaryGenre,
      trackCount: album.trackCount,
      conceptSummary: album.conceptSummary,
    }),
    tag: album.status === "draft" ? "draft" : undefined,
    cover: album.coverUrl ?? undefined,
  }));

  return (
    <div className="flex flex-col gap-5">
      <WorkspaceFunnelCard summary={funnel} />

      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--muted2)]">For you</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Recent projects
        </div>
        {items.length ? (
          <div className="max-w-[64ch] text-sm text-[var(--muted)]">
            Pick up where you left off. Projects are synced to Neon (Postgres) and your Stripe
            plan.
          </div>
        ) : (
          <div className="max-w-[64ch] text-sm text-[var(--muted)]">
            Your library is empty. Create your first concept album and export it to your DAW.
          </div>
        )}
      </div>

      {items.length ? (
        <div className="grid grid-cols-1 gap-3">
          {items.map((album) => (
            <AlbumCard key={album.id} album={album} href={`/app/albums/${album.id}`} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6">
          <div className="text-sm font-semibold text-[var(--text)]">Start here</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Generate an `album.json` scaffold, save it, then iterate track by track.
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/app/create"
              className="rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-5 py-3 text-sm font-semibold text-black hover:brightness-110"
            >
              Create album
            </Link>
            <Link
              href="/app/settings/billing"
              className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              View plans
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
