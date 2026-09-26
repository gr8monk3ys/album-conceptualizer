"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      // A row in the account block's tight list, like the Settings and Help rows above it: the
      // focus ring is drawn inside it so the row below (or the scrolling column) can't clip it.
      className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink focus-visible:-outline-offset-2"
    >
      <LogOut className="h-4 w-4 text-ink-3" aria-hidden="true" />
      Sign out
    </button>
  );
}
