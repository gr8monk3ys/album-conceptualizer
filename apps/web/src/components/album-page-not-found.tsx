"use client";

import { usePathname } from "next/navigation";

import { ButtonLink } from "@/components/ui";
import { missingAlbumPage } from "@/lib/missing-page";

/**
 * The not-found screen inside an album. The release header, tabs and spine stay above it, so
 * it says what is actually missing (a page of this album, not the album) and leads back to
 * the album's Overview, its one primary action.
 */
export function AlbumPageNotFound() {
  const missing = missingAlbumPage(usePathname() ?? "");
  // The page's h1: the release title above is set as a paragraph on this screen
  // (ReleaseTitle), so the heading names what is actually missing.
  return (
    <section aria-labelledby="album-not-found-title" className="border-t border-line pt-6">
      <h1 id="album-not-found-title" className="break-words text-lg font-semibold text-ink">
        {missing ? `This album has no page called “${missing.page}”` : "This album has no such page"}
      </h1>
      <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
        Its pages are the tabs above: Overview, Studio, Bible, Coherence, Sound and Export. The album itself is still here.
      </p>
      <div className="mt-4">
        <ButtonLink tone="primary" href={missing ? `/app/albums/${missing.albumId}` : "/app/library"}>
          Go to the album’s Overview
        </ButtonLink>
      </div>
    </section>
  );
}
