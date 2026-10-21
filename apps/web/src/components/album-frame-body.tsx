"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AlbumBody } from "@/components/album-nav";
import { AlbumSpine } from "@/components/album-spine";
import { spineShowsThemes } from "@/lib/spine-route";
import type { SpineRow } from "@/server/album-songs";

/**
 * The album body with the spine each album page gets. A layout isn't told which page it wraps,
 * so the page is read from the address here: on the Story bible the spine leaves its theme
 * columns to the page's Theme map (and the side column keeps its narrowest width, since no
 * theme heads need room); every other page gets the whole track sheet.
 */
export function AlbumFrameBody({
  albumId,
  rows,
  themes,
  children,
}: {
  albumId: string;
  rows: SpineRow[];
  /** The album's central themes, at most six, in the order the artist set them. */
  themes: string[];
  children: ReactNode;
}) {
  const showThemes = spineShowsThemes(usePathname());
  return (
    <AlbumBody
      trackCount={rows.length}
      themeCount={showThemes ? themes.length : 0}
      spine={<AlbumSpine albumId={albumId} rows={rows} themes={themes} showThemes={showThemes} />}
      compactSpine={
        <AlbumSpine
          albumId={albumId}
          rows={rows}
          themes={themes}
          showThemes={showThemes}
          heading={false}
          idPrefix="album-spine-compact"
        />
      }
    >
      {children}
    </AlbumBody>
  );
}
