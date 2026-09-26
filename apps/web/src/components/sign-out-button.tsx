"use client";

import { LogOut } from "lucide-react";

/** next-auth's own sign-out page: it signs out without any of this page's scripts. */
export const SIGN_OUT_PAGE = "/api/auth/signout";

type SignOutClient = { signOut: (options: { callbackUrl: string }) => Promise<unknown> };

// next-auth's client is loaded when the button is pressed, not with the page: it sits in the
// sidebar and the mobile sheet on every app screen, and its module (with its Babel runtime)
// was evaluated in the start-up task of each of them only to sign out. Should it not load
// (offline, or a deploy replaced the chunk) or signing out fail, the press still signs out,
// through next-auth's own page.
export async function signOutToFrontPage(
  load: () => Promise<SignOutClient> = () => import("next-auth/react"),
  navigate: (href: string) => void = (href) => window.location.assign(href),
) {
  try {
    const { signOut } = await load();
    await signOut({ callbackUrl: "/" });
  } catch {
    navigate(SIGN_OUT_PAGE);
  }
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOutToFrontPage()}
      // A row in the account block's tight list, like the Settings and Help rows above it: the
      // focus ring is drawn inside it so the row below (or the scrolling column) can't clip it.
      className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink focus-visible:-outline-offset-2"
    >
      <LogOut className="h-4 w-4 text-ink-3" aria-hidden="true" />
      Sign out
    </button>
  );
}
