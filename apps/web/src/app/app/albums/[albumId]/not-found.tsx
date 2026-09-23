import { AlbumPageNotFound } from "@/components/album-page-not-found";

// Rendered inside the album layout, under the album's release header and tabs. A missing
// album is handled a level up (app/app/not-found.tsx), because the layout itself calls
// notFound() then. The root template makes the tab "Page not found · Album Conceptualizer".
export const metadata = { title: "Page not found" };

export default function AlbumNotFound() {
  return <AlbumPageNotFound />;
}
