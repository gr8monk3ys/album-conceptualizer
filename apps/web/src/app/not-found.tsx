import Link from "next/link";

import { PageNotFoundTitle } from "@/components/page-not-found-title";
import { Wordmark } from "@/components/sidebar";
import { ButtonLink } from "@/components/ui";

export const metadata = { title: "Page not found" };

// Addresses outside the app, and share links that were revoked or expired: the way into the
// app, and the front page for someone who arrived from outside.
export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-ground px-4 py-6 sm:px-6">
      <PageNotFoundTitle />
      <div className="mx-auto max-w-[1200px]">
        <header>
          <Link href="/" className="inline-flex min-h-11 items-center rounded">
            <Wordmark />
          </Link>
        </header>
        <main className="mt-16 max-w-[36rem] md:mt-24">
          <h1 className="type-display text-display-lg break-words hyphens-auto text-ink">Page not found</h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            There&apos;s nothing at this address. The link may be mistyped, or the album or share
            link it pointed to may have been removed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/app" tone="primary">
              Go to your albums
            </ButtonLink>
            <ButtonLink href="/" tone="secondary">
              Go to the front page
            </ButtonLink>
          </div>
        </main>
      </div>
    </div>
  );
}
