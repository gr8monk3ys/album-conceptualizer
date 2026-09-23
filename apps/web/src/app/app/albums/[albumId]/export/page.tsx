import { notFound } from "next/navigation";

import { AlbumExport } from "@/components/album-export";
import { getAlbum } from "@/server/albums";
import { getCredits } from "@/server/credits";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Export",
  description: "Download album bundles as MIDI, ChordPro, MusicXML, JSON, and text.",
};

// The album layout renders the title, catalog line, album tabs and spine above this page.
export default async function AlbumExportPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const credits = await getCredits({
    workspaceId: workspace.id,
    plan: effectivePlan(workspace.subscription),
  });

  return <AlbumExport albumId={album.id} creditsRemaining={credits.remaining} />;
}
