"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function UserMenu({
  name,
  email,
  imageUrl,
}: {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
}) {
  const initial = (name || email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right leading-tight md:block">
        <div className="max-w-[220px] truncate text-xs font-semibold text-[var(--text)]">
          {name || "User"}
        </div>
        <div className="max-w-[220px] truncate text-[11px] text-[var(--muted2)]">{email}</div>
      </div>
      <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] text-xs font-semibold text-[var(--text)]">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="36px" unoptimized className="object-cover" />
        ) : (
          initial
        )}
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--muted)] hover:bg-[rgba(255,255,255,0.07)]"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
