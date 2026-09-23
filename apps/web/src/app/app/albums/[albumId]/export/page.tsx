import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlbumExport } from "@/components/album-export";
import { ReadinessList } from "@/components/album-readiness";
import { Section } from "@/components/ui";
import { getAlbum } from "@/server/albums";
import { getCredits } from "@/server/credits";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getAlbumReadiness } from "@/server/readiness";
import { albumPageTitle, workspaceAlbumTitle } from "@/server/page-titles";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
/** "Export · <album title>" in the browser tab and history. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  return {
    title: albumPageTitle("Export", await workspaceAlbumTitle(albumId)),
    description: "Download album bundles as MIDI, ChordPro, MusicXML, JSON, and text.",
  };
}

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

  // Readiness first: what the packs and the zip will carry as the album stands. It informs;
  // every download still works.
  const readiness = getAlbumReadiness(album.id, album.data);

  return (
    <div className="flex flex-col gap-10">
      <Section
        id="export-readiness"
        title="Before you hand off"
        description={
          readiness.ready
            ? "Every track is written with chords of its own, and the Style bible is set."
            : "What a handoff carries right now. Each item opens where it's finished; nothing here stops a download."
        }
      >
        <ReadinessList items={readiness.items} />
      </Section>
      <AlbumExport albumId={album.id} creditsRemaining={credits.remaining} />
    </div>
  );
}
