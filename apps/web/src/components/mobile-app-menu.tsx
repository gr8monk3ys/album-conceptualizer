"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AccountBlock } from "@/components/account-block";
import { AppNavLinks } from "@/components/app-nav-links";
import { CreditsMeter } from "@/components/credits-meter";
import { FadeScroll } from "@/components/fade-scroll";
import { Wordmark } from "@/components/sidebar";
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
        className="m-0 h-full max-h-none w-[min(20rem,88vw)] max-w-none overflow-hidden border-r border-line bg-ground p-0 text-ink backdrop:bg-sunken/80 md:hidden"
      >
        {/* The sheet scrolls as one column, and fades at the edge with more past it; nothing
            in it shrinks, so the navigation stays whole on a short landscape screen or with
            enlarged text. */}
        <FadeScroll className="h-full overflow-y-auto">
          <div className="flex min-h-full flex-col gap-6 px-3 py-4 *:shrink-0">
            <div className="flex items-start justify-between gap-2 pl-3">
              {/* flex-1: the wordmark sizes itself to this column (a size container). */}
              <div className="min-w-0 flex-1 pt-2 @container">
                <Wordmark fit />
                <span className="mt-1 block break-words text-xs text-ink-3">{workspaceName}</span>
              </div>
              <IconButton label="Close navigation menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" aria-hidden="true" />
              </IconButton>
            </div>
            <AppNavLinks unreadNotifications={unreadNotifications} onNavigate={() => setOpen(false)} />
            <div className="mt-auto">
              <CreditsMeter credits={credits} />
            </div>
            {/* The same account block as the sidebar, Upgrade included. */}
            <AccountBlock userName={userName} plan={plan} onNavigate={() => setOpen(false)} />
          </div>
        </FadeScroll>
      </dialog>
    </>
  );
}
