import Link from "next/link";
import { notFound } from "next/navigation";

import { AlbumExport } from "@/components/album-export";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album Export",
  description: "Download album bundles as MIDI, ChordPro, MusicXML, JSON, and text.",
};

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-[var(--muted2)]">Project</div>
          <div className="truncate text-lg font-semibold text-[var(--text)]">{album.title}</div>
        </div>
        <Link
          href={`/app/albums/${album.id}`}
          className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        >
          Back
        </Link>
      </div>

      <AlbumExport albumId={album.id} />
    </div>
  );
}
