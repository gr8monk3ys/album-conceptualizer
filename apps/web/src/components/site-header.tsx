import Link from "next/link";

import { Wordmark } from "@/components/sidebar";
import { buttonClass } from "@/components/ui";

/**
 * Header for the public pages (`/`, `/sign-in`, shared albums): the wordmark, which leads
 * home, and a way in. The sign-in page passes `showSignIn={false}` so it never offers a
 * "Sign in" button on the sign-in page itself.
 */
export function SiteHeader({ showSignIn = true }: { showSignIn?: boolean }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
      <Link href="/" className="inline-flex min-h-11 min-w-0 items-center rounded">
        <Wordmark className="text-base" />
      </Link>

      {showSignIn ? (
        <nav aria-label="Account">
          <Link href="/sign-in" className={buttonClass("ghost", "text-ink")}>
            Sign in
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
