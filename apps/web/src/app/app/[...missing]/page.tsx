import type { Metadata } from "next";
import { notFound } from "next/navigation";

// The page's own metadata must say it too: the render below throws, but the browser tab takes
// its title from this segment's metadata once the page hydrates, and without it the tab fell
// back to the bare product name ("Page not found · Album Conceptualizer" only lasted until then).
export const metadata: Metadata = { title: "Page not found" };

// Any /app URL without a page renders the app's own not-found screen, inside the shell.
export default function MissingAppPage() {
  notFound();
}
