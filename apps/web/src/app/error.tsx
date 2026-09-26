"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Wordmark } from "@/components/wordmark";
import { Button, ButtonLink } from "@/components/ui";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-ground px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/" className="inline-flex min-h-11 items-center rounded">
          <Wordmark />
        </Link>
        <main className="mt-16 max-w-[36rem] md:mt-24">
          <h1 className="type-display text-display-lg break-words hyphens-auto text-ink">This page didn&apos;t load</h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            Something went wrong on our side while opening it. Try again; if it keeps happening, go
            back to the start and open the page from there in a minute or two.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button tone="primary" onClick={reset}>
              Try again
            </Button>
            <ButtonLink href="/" tone="secondary">
              Go to the front page
            </ButtonLink>
          </div>
          {error.digest ? (
            <p className="mt-6 text-xs text-ink-3">
              If you contact support, mention this reference: <span className="type-figure">{error.digest}</span>
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}
