import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { AlbumStudio } from "@/components/album-studio";
import { PlayerProvider } from "@/components/player/player-provider";
import { Playerbar } from "@/components/playerbar";
import { getAlbum } from "@/server/albums";
import { getCredits } from "@/server/credits";
import { getAgentAvailability } from "@/server/engine";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album Studio",
  description: "Edit songs, lyrics, chords, and section-level details for your album.",
};

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

// The album layout provides the h1, catalog line and album tabs; the Studio starts at h2.
export default async function AlbumStudioPage({
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
  const [album, aiAvailable, credits] = await Promise.all([
    getAlbum(workspace.id, albumId),
    getAgentAvailability(),
    // For the AI drafting confirm: "You'll have N left."
    getCredits({ workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) }),
  ]);
  if (!album) notFound();

  return (
    <PlayerProvider>
      <AlbumPageViewTracker albumId={album.id} event="album_studio_viewed" path={`/app/albums/${album.id}/studio`} />
      <AlbumStudio
        albumId={album.id}
        initialAlbum={album.data}
        aiAvailable={aiAvailable}
        creditsRemaining={credits.remaining}
        initialSelection={{
          song: param(query.song),
          section: param(query.section),
          sid: param(query.sid),
          q: param(query.q),
          focus: param(query.focus),
        }}
      />
      <Playerbar />
    </PlayerProvider>
  );
}
