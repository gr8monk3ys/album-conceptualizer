"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

import { APP_MAIN_ID, appSkipTarget } from "@/lib/album-skip";

/**
 * The page's one skip link, the first stop in the document (`appSkipTarget`): on an album
 * screen it goes past the sidebar, the header, the release header, the tabs and the sequence
 * to the page itself, and is named for it ("Skip to the Overview"); on the Studio it is "Skip
 * to the lyrics" and does what the Studio's own link does (the current section's lyrics);
 * elsewhere "Skip to content". Focus-only, in saffron, at the top left.
 */
export function AppSkipLink() {
  const { label, targetId, studio } = appSkipTarget(usePathname() ?? "");

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // The Studio's own link knows the current section: hand over to it.
    const studioLink = studio
      ? document.querySelector<HTMLAnchorElement>(`#${APP_MAIN_ID} a[href="#${targetId}"]`)
      : null;
    if (studioLink) {
      event.preventDefault();
      studioLink.click();
      return;
    }
    // An album address with no page (the not-found screen) has no album page to land on.
    if (!document.getElementById(targetId)) {
      event.preventDefault();
      const main = document.getElementById(APP_MAIN_ID);
      main?.focus();
      main?.scrollIntoView({ block: "start" });
    }
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={onClick}
      className="sr-only z-50 rounded bg-accent text-sm font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4 focus:py-3"
    >
      {label}
    </a>
  );
}
