"use client";

import { useEffect } from "react";

type AlbumPageViewEvent =
  | "album_bible_viewed"
  | "album_studio_viewed"
  | "album_coherence_viewed"
  | "album_style_bible_viewed"
  | "album_rough_demos_viewed";

type AlbumPageViewTrackerProps = {
  albumId: string;
  event: AlbumPageViewEvent;
  path: string;
};

/** Runs `work` once the page is idle (after start-up), or within two seconds at the latest. */
function whenIdle(work: () => void) {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(work, { timeout: 2000 });
  else window.setTimeout(work, 0);
}

export function AlbumPageViewTracker({ albumId, event, path }: AlbumPageViewTrackerProps) {
  useEffect(() => {
    // Sent once the page is idle: the first sessionStorage read and the beacon cost about 15ms
    // on a throttled phone, and here they ran with every other effect of the first render, in
    // one of the page's long tasks. Not cancelled on unmount: the view happened either way.
    whenIdle(() => {
      const dedupeKey = `album-page-view:${event}:${albumId}`;
      try {
        if (window.sessionStorage.getItem(dedupeKey) === "1") {
          return;
        }
        window.sessionStorage.setItem(dedupeKey, "1");
      } catch {
        // Ignore storage failures and still attempt delivery.
      }

      const body = JSON.stringify({ albumId, event, path });

      if (navigator.sendBeacon) {
        const accepted = navigator.sendBeacon(
          "/api/analytics/album-view",
          new Blob([body], { type: "application/json" }),
        );
        if (accepted) {
          return;
        }
      }

      const request = new XMLHttpRequest();
      request.open("POST", "/api/analytics/album-view", true);
      request.setRequestHeader("content-type", "application/json");
      request.send(body);
    });
  }, [albumId, event, path]);

  return null;
}
