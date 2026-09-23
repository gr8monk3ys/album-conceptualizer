import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlbumVersions } from "@/components/album-versions";
import { getAlbum } from "@/server/albums";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { albumPageTitle, workspaceAlbumTitle } from "@/server/page-titles";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
/** "Versions · <album title>" in the browser tab and history. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  return {
    title: albumPageTitle("Versions", await workspaceAlbumTitle(albumId)),
    description: "Save versions of the album and restore earlier ones.",
  };
}

export default async function VersionsPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const versions = await getPrisma().albumVersion.findMany({
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
    <AlbumVersions
      albumId={album.id}
      versions={versions.map((v) => ({
        id: v.id,
        message: v.message,
        createdAt: v.createdAt.toISOString(),
        createdBy: v.createdBy,
      }))}
    />
  );
}
