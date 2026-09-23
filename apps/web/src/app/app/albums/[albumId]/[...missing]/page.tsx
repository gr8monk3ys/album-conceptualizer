import { notFound } from "next/navigation";

// An address inside an album that isn't one of its pages (/app/albums/<id>/<anything else>)
// renders the album's own not-found screen, under its release header and tabs, instead of
// the app-wide one that would suggest the album itself is gone.
export default function MissingAlbumPage() {
  notFound();
}
