"use client";

import Link from "next/link";
import { useState } from "react";

import { CatalogItems } from "@/components/album-card";
import { LikeToggle, RemixButton } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
import { StatusMessage } from "@/components/ui";

type DiscoverAlbum = {
  id: string;
  title: string;
  artist: string | null;
  conceptSummary: string | null;
  primaryGenre: string | null;
  trackCount: number;
  publishedAt: string | null;
  likes: number;
  liked: boolean;
};

/**
 * One published album as a row: title, catalog line and the first lines of its concept (the
 * reason to open it), then Like and Remix.
 */
export function DiscoverAlbumCard({
  album,
  creditsRemaining,
}: {
  album: DiscoverAlbum;
  creditsRemaining?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const tracks = `${album.trackCount} ${album.trackCount === 1 ? "track" : "tracks"}`;

  return (
    <div
      className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
      data-testid="discover-album-card"
      data-album-id={album.id}
    >
      <div className="min-w-0 md:flex-1">
        <Link
          href={`/app/discover/${album.id}`}
          className="type-display inline-block max-w-full break-words py-2 text-xl text-ink hyphens-auto underline-offset-4 hover:underline md:text-2xl"
        >
          {album.title}
        </Link>
        <p className="type-catalog mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-2">
          <CatalogItems
            items={[
              album.artist || "Artist not named",
              album.primaryGenre,
              <span key="tracks" className="type-figure">{tracks}</span>,
              album.publishedAt ? (
                <span key="published">
                  Published <RelativeTime date={album.publishedAt} />
                </span>
              ) : null,
            ]}
          />
        </p>
        {album.conceptSummary ? (
          <p className="mt-2 line-clamp-2 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
            {album.conceptSummary}
          </p>
        ) : null}
        {error ? <StatusMessage tone="danger" className="mt-2">{error}</StatusMessage> : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <LikeToggle
          albumId={album.id}
          albumTitle={album.title}
          initialLiked={album.liked}
          initialLikes={album.likes}
          onError={setError}
        />
        <RemixButton
          albumId={album.id}
          albumTitle={album.title}
          creditsRemaining={creditsRemaining}
          onError={setError}
        />
      </div>
    </div>
  );
}
