"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppNavLinks, SettingsNavLink } from "@/components/app-nav-links";
import { CreditsMeter } from "@/components/credits-meter";
import { Wordmark } from "@/components/sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { IconButton } from "@/components/ui";

export function MobileAppMenu({
  workspaceName,
  userName,
  plan,
  credits,
  unreadNotifications,
}: {
  workspaceName: string;
  userName?: string | null;
  plan?: string | null;
  credits?: { remaining: number; total: number };
  unreadNotifications?: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <IconButton
        label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-app-menu"
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      <dialog
        id="mobile-app-menu"
        ref={dialogRef}
        aria-label="Navigation"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="m-0 h-full max-h-none w-[min(20rem,88vw)] max-w-none border-r border-line bg-ground p-0 text-ink backdrop:bg-sunken/80 md:hidden"
      >
        <div className="flex h-full flex-col gap-6 px-3 py-4">
          <div className="flex items-start justify-between gap-2 pl-3">
            <div className="min-w-0 pt-2">
              <Wordmark />
              <span className="mt-1 block break-words text-xs text-ink-3">{workspaceName}</span>
            </div>
            <IconButton label="Close navigation menu" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" aria-hidden="true" />
            </IconButton>
          </div>
          <div className="flex-1 overflow-auto">
            <AppNavLinks unreadNotifications={unreadNotifications} onNavigate={() => setOpen(false)} />
          </div>
          <CreditsMeter credits={credits} />
          <div className="border-t border-line pt-4">
            <div className="px-3">
              <p className="break-words text-sm font-medium text-ink">{userName || "You"}</p>
              <p className="text-xs capitalize text-ink-3">{plan ?? "free"} plan</p>
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              <SettingsNavLink onNavigate={() => setOpen(false)} />
              <SignOutButton />
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
