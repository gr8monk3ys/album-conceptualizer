import { notFound } from "next/navigation";

// Any /app URL without a page renders the app's own not-found screen, inside the shell.
export default function MissingAppPage() {
  notFound();
}
