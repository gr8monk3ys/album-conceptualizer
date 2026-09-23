"use client";

import Link from "next/link";
import { useState } from "react";

import { CatalogItems } from "@/components/album-card";
import { LikeToggle, OpenInStudioLink, RemixButton } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
import { StatusMessage } from "@/components/ui";

type DiscoverAlbum = {
  id: string;
  title: string;
  artist: string | null;
  conceptSummary: string | null;
  primaryGenre: string | null;
  /** "7 tracks · lyrics on 5" (see `writtenSummaryLine` in @/lib/discover). */
  written: string;
  /** The album's central themes, in the artist's order. */
  themes: string[];
  /** The viewer's own album: it opens in the Studio instead of offering a remix. */
  isOwn: boolean;
  publishedAt: string | null;
  likes: number;
  liked: boolean;
};

/**
 * One published album as a row: title, catalog line (artist, genre, how much is written), its
 * themes and the first lines of its concept (the reason to open it), then Like and Remix, or
 * "Open in Studio" on the viewer's own album.
 */
export function DiscoverAlbumCard({
  album,
  creditsRemaining,
}: {
  album: DiscoverAlbum;
  creditsRemaining: number;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
      data-testid="discover-album-card"
      data-album-id={album.id}
    >
      <div className="min-w-0 md:flex-1">
        <Link
          href={`/app/discover/${album.id}`}
          className="type-display inline-flex min-h-11 max-w-full items-center break-words py-2 text-xl text-ink hyphens-auto underline-offset-4 hover:underline md:text-2xl"
        >
          {album.title}
        </Link>
        <p className="type-catalog mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-2">
          <CatalogItems
            items={[
              album.artist || "Artist not named",
              album.primaryGenre,
              <span key="written" className="type-figure">{album.written}</span>,
              album.publishedAt ? (
                <span key="published">
                  Published <RelativeTime date={album.publishedAt} />
                </span>
              ) : null,
            ]}
          />
        </p>
        {album.themes.length ? (
          <p className="mt-2 max-w-[65ch] break-words text-sm text-ink-2">
            <span className="text-ink-3">Themes: </span>
            {album.themes.join(" · ")}
          </p>
        ) : null}
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
        {album.isOwn ? (
          <OpenInStudioLink albumId={album.id} albumTitle={album.title} />
        ) : (
          <RemixButton
            albumId={album.id}
            albumTitle={album.title}
            creditsRemaining={creditsRemaining}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}
