"use client";

import { usePathname } from "next/navigation";

import { ButtonLink, Section } from "@/components/ui";
import { missingAlbumPage } from "@/lib/missing-page";

/**
 * The not-found screen inside an album. The release header, tabs and spine stay above it, so
 * it says what is actually missing (a page of this album, not the album) and leads back to
 * the album's Overview, its one primary action.
 */
export function AlbumPageNotFound() {
  const missing = missingAlbumPage(usePathname() ?? "");
  return (
    <Section
      id="album-not-found"
      title={missing ? `This album has no page called “${missing.page}”` : "This album has no such page"}
      description="Its pages are the tabs above: Overview, Studio, Bible, Coherence, Sound and Export. The album itself is still here."
    >
      <ButtonLink tone="primary" href={missing ? `/app/albums/${missing.albumId}` : "/app/library"}>
        Go to the album’s Overview
      </ButtonLink>
    </Section>
  );
}
