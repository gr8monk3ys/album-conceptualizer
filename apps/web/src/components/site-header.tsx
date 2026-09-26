import Link from "next/link";

import { Wordmark } from "@/components/wordmark";
import { buttonClass } from "@/components/ui";

/**
 * Header for the public pages (`/`, `/sign-in`, shared albums): the wordmark, which leads
 * home, and a way in. The sign-in page passes `showSignIn={false}` so it never offers a
 * "Sign in" button on the sign-in page itself.
 */
export function SiteHeader({ showSignIn = true }: { showSignIn?: boolean }) {
  return (
    <header className="@container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
      <Link href="/" className="inline-flex min-h-11 min-w-0 items-center rounded">
        {/* Never smaller than at 100% text, never wider than the header: "CONCEPTUALIZER" is
            about 8.9em wide in this cut, so 10.5cqi keeps it inside the column at 320px and 200%. */}
        <Wordmark className="text-[length:max(min(1rem,16px),min(1rem,10.5cqi))]" />
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
