import type { Metadata } from "next";
import { notFound } from "next/navigation";

// The page's own metadata must say it too: the render below throws, but the browser tab takes
// its title from this segment's metadata once the page hydrates, and without it the tab fell
// back to the bare product name ("Page not found · Album Conceptualizer" only lasted until then).
export const metadata: Metadata = { title: "Page not found" };

// An address inside an album that isn't one of its pages (/app/albums/<id>/<anything else>)
// renders the album's own not-found screen, under its release header and tabs, instead of
// the app-wide one that would suggest the album itself is gone.
export default function MissingAlbumPage() {
  notFound();
}
