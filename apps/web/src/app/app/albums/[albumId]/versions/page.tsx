import Link from "next/link";
import { notFound } from "next/navigation";

import { AlbumVersions } from "@/components/album-versions";
import { getAlbum } from "@/server/albums";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Version History",
  description: "Save, inspect, and restore album snapshots.",
};

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const prisma = getPrisma();
  const versions = await prisma.albumVersion.findMany({
    where: { albumId: album.id, album: { workspaceId: workspace.id } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      message: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-[var(--muted2)]">Project</div>
          <div className="truncate text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">Version history</div>
        </div>
        <Link
          href={`/app/albums/${album.id}`}
          className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        >
          Back
        </Link>
      </div>

      <AlbumVersions
        albumId={album.id}
        versions={versions.map((v) => ({
          id: v.id,
          message: v.message,
          createdAt: v.createdAt.toISOString(),
          createdBy: v.createdBy,
        }))}
      />
    </div>
  );
}
