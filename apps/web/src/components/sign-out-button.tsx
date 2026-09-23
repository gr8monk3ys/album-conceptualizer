"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink"
    >
      <LogOut className="h-4 w-4 text-ink-3" aria-hidden="true" />
      Sign out
    </button>
  );
}
