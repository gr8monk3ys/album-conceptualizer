import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

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

/** The signed-in workspace's album, read once per request for both the title and the page. */
const loadStudio = cache(async (albumId: string) => {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  return { workspace, album };
});

// "Studio · Night Radio" (the root layout's template adds " · Album Conceptualizer").
export async function generateMetadata({ params }: { params: Promise<{ albumId: string }> }): Promise<Metadata> {
  const { albumId } = await params;
  const { album } = await loadStudio(albumId);
  if (!album) return { title: "Page not found" };
  return {
    title: `Studio · ${album.title}`,
    description: "Write each track's lyrics and chords inside the album's sequence.",
  };
}

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

  const { workspace, album } = await loadStudio(albumId);
  const [aiAvailable, credits] = await Promise.all([
    getAgentAvailability(),
    // For the AI draft confirm: "You'll have N left."
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
        // Remix lands here with ?remixed=1: the Studio says so once, then drops the param.
        arrival={param(query.remixed) === "1" ? "remixed" : null}
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
