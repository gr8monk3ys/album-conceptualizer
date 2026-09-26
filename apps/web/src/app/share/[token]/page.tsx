import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { CatalogItems } from "@/components/album-card";
import { ForkShareButton } from "@/components/fork-share-button";
import { RelativeTime } from "@/components/relative-time";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink, EmptyState } from "@/components/ui";
import { getAuthSession } from "@/server/auth";
import { getCredits } from "@/server/credits";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { getAlbumSongOptions } from "@/server/album-songs";
import { findSharedAlbum } from "@/server/share-links";

export const dynamic = "force-dynamic";

/** The album behind the link, loaded once per request for the title and the page. */
const loadSharedAlbum = cache((token: string) =>
  findSharedAlbum(token, {
    id: true,
    title: true,
    artist: true,
    conceptSummary: true,
    data: true,
    updatedAt: true,
  }),
);

/** A shared link reads as the album it opens: "<album> · Album Conceptualizer". */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const album = await loadSharedAlbum(token);
  // A revoked or expired link is not found here too, so the tab keeps "Page not found" once
  // the page hydrates instead of a fallback title.
  if (!album) notFound();
  return {
    title: album.title.trim() || "Shared album",
    description: "A shared concept album: read its sequence and remix it into your own workspace.",
  };
}

type ShareTrack = {
  trackNumber: number;
  title: string;
  role: string | null;
  themes: string[];
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Each track's role and themes, read from the shared album snapshot. */
function getShareTracks(data: unknown): ShareTrack[] {
  const songs = (data as { songs?: unknown } | null)?.songs;
  const byNumber = new Map<number, Record<string, unknown>>();
  if (Array.isArray(songs)) {
    for (const raw of songs) {
      if (raw && typeof raw === "object") {
        const song = raw as Record<string, unknown>;
        if (typeof song.track_number === "number") byNumber.set(song.track_number, song);
      }
    }
  }
  return getAlbumSongOptions(data).map((option) => {
    const song = byNumber.get(option.trackNumber) ?? {};
    const themes = Array.isArray(song.themes)
      ? song.themes.filter((theme): theme is string => typeof theme === "string" && theme.trim().length > 0)
      : [];
    return {
      trackNumber: option.trackNumber,
      title: option.title,
      role: text(song.narrative_summary) ?? text(song.narrative_position),
      themes,
    };
  });
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getAuthSession();
  const album = await loadSharedAlbum(token);
  if (!album) notFound();

  const tracks = getShareTracks(album.data);
  const callbackUrl = `/share/${token}`;
  const userId = session?.user?.id;
  const signedIn = Boolean(userId);
  // A signed-in viewer's balance, so the remix confirm can say what's left after it.
  let creditsRemaining: number | undefined;
  if (userId) {
    const workspace = await getActiveWorkspaceForUser(userId);
    creditsRemaining = (
      await getCredits({ workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) })
    ).remaining;
  }

  return (
    <div className="min-h-screen bg-ground text-ink">
      <div className="mx-auto flex max-w-[1000px] flex-col px-4 pb-16 pt-4 sm:px-6 md:pt-6">
        <SiteHeader showSignIn={!signedIn} />

        <main className="mt-10 flex flex-col gap-10 md:mt-14">
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
            <div className="min-w-0 max-w-[40rem]">
              <h1 className="type-display text-display-xl break-words hyphens-auto text-ink">{album.title}</h1>
              <p className="type-catalog mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-2">
                <CatalogItems
                  items={[
                    album.artist || "No artist yet",
                    <span key="tracks" className="type-figure">
                      {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
                    </span>,
                    "Shared album",
                    <span key="edited">
                      Edited <RelativeTime date={album.updatedAt.toISOString()} />
                    </span>,
                  ]}
                />
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              {signedIn ? (
                <ForkShareButton token={token} creditsRemaining={creditsRemaining} />
              ) : (
                <ButtonLink
                  tone="primary"
                  href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                >
                  Sign in to remix
                </ButtonLink>
              )}
            </div>
          </header>

          {album.conceptSummary ? (
            <section aria-labelledby="share-concept-title" className="border-t border-line pt-6">
              <h2 id="share-concept-title" className="text-lg font-semibold text-ink">
                Concept
              </h2>
              <p className="mt-2 max-w-[65ch] whitespace-pre-line break-words text-base leading-relaxed text-ink-2">
                {album.conceptSummary}
              </p>
            </section>
          ) : null}

          <section aria-labelledby="share-sequence-title" className="border-t border-line pt-6">
            <h2 id="share-sequence-title" className="text-lg font-semibold text-ink">
              Sequence
            </h2>
            {tracks.length ? (
              <ol className="mt-3 border-t border-line">
                {tracks.map((track) => (
                  <li
                    key={`${track.trackNumber}-${track.title}`}
                    className="flex min-h-11 items-baseline gap-4 border-b border-line py-3"
                  >
                    <span className="type-figure w-9 shrink-0 text-2xl font-semibold text-ink-3">
                      {String(track.trackNumber).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-semibold text-ink hyphens-auto">{track.title}</p>
                      {track.role ? (
                        <p className="mt-0.5 line-clamp-2 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">{track.role}</p>
                      ) : null}
                      {track.themes.length ? (
                        <p className="type-catalog mt-1 text-xs text-ink-3">
                          <span className="sr-only">Themes: </span>
                          {track.themes.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No tracks in this album yet" className="mt-3">
                The owner hasn&apos;t added any tracks. You can still remix it and build the sequence
                yourself.
              </EmptyState>
            )}
            <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-ink-3">
              This is a read-only preview. Remix it to get your own copy in your workspace, where you
              can write, check coherence and export.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
