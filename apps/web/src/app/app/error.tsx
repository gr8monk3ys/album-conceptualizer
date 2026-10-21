"use client";

import { useEffect } from "react";

import { Button, ButtonLink, PageHeader } from "@/components/ui";

export default function AppError({
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
    <div className="flex flex-col gap-6 py-8">
      <PageHeader
        title="This page didn’t load"
        description="Something went wrong on our side while opening it. Your albums and everything you saved are safe. Try again; if it keeps happening, go to Home and open it from there."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="primary" onClick={reset}>
          Try again
        </Button>
        <ButtonLink tone="secondary" href="/app">
          Go to Home
        </ButtonLink>
      </div>
      {error.digest ? (
        <p className="text-xs text-ink-3">
          If you contact support, mention this reference: <span className="type-figure">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
