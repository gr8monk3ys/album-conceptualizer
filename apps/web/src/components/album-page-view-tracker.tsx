"use client";

import { useEffect } from "react";

type AlbumPageViewEvent =
  | "album_bible_viewed"
  | "album_studio_viewed"
  | "album_coherence_viewed";

type AlbumPageViewTrackerProps = {
  albumId: string;
  event: AlbumPageViewEvent;
  path: string;
};

export function AlbumPageViewTracker({ albumId, event, path }: AlbumPageViewTrackerProps) {
  useEffect(() => {
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
  }, [albumId, event, path]);

  return null;
}
