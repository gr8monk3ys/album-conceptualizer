import Link from "next/link";

import { Wordmark } from "@/components/sidebar";
import { ButtonLink } from "@/components/ui";

export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-ground px-4 py-6 sm:px-6">
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
              Go home
            </ButtonLink>
          </div>
        </main>
      </div>
    </div>
  );
}
