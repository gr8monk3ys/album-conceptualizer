"use client";

import Link from "next/link";

import { HelpNavLink, SettingsNavLink } from "@/components/app-nav-links";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * The foot of the navigation, the same in the sidebar and the mobile sheet: who is signed in
 * and on which plan, Upgrade while on the free plan, then Settings, Help and Sign out.
 * `onNavigate` closes the mobile sheet when one of its links is followed.
 */
export function AccountBlock({
  userName,
  plan,
  onNavigate,
}: {
  userName?: string | null;
  plan?: string | null;
  onNavigate?: () => void;
}) {
  const showUpgrade = plan !== "pro" && plan !== "team";
  return (
    <div className="border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 px-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-ink">{userName || "You"}</p>
          <p className="text-xs capitalize text-ink-3">{plan ?? "free"} plan</p>
        </div>
        {showUpgrade ? (
          <Link
            href="/app/settings/billing"
            onClick={onNavigate}
            className="inline-flex min-h-11 items-center rounded px-2 text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Upgrade
          </Link>
        ) : null}
      </div>
      <div className="mt-2 flex flex-col gap-0.5">
        <SettingsNavLink onNavigate={onNavigate} />
        <HelpNavLink onNavigate={onNavigate} />
        <SignOutButton />
      </div>
    </div>
  );
}
