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
  primaryGenre: string | null;
  trackCount: number;
  publishedAt: string | null;
  likes: number;
  liked: boolean;
};

/** One published album as a row: title and catalog line, then Like and Remix. */
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
      <div className="min-w-0">
        <Link
          href={`/app/discover/${album.id}`}
          className="type-display inline-flex min-h-11 max-w-full items-center text-xl text-ink underline-offset-4 hover:underline md:text-2xl"
        >
          <span className="truncate">{album.title}</span>
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
        {error ? <StatusMessage tone="danger" className="mt-2">{error}</StatusMessage> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-start gap-3">
        <LikeToggle
          albumId={album.id}
          initialLiked={album.liked}
          initialLikes={album.likes}
          onError={setError}
        />
        <RemixButton albumId={album.id} creditsRemaining={creditsRemaining} onError={setError} />
      </div>
    </div>
  );
}
