"use client";

import Link from "next/link";
import { useEffect } from "react";

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
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--bad)]" />
          Something went wrong
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[var(--text)]">
          Unexpected error
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          An error occurred while loading this page. Please try again, and if the problem persists
          contact support.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-2xl bg-[rgba(255,255,255,0.10)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.14)]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
