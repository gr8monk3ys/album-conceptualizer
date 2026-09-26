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
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The sheet opens on its Close button, a named control, never on the scrolling column
      // (at 320px with 200% text the column overflows and is itself focusable). `autoFocus`
      // on the button says the same for the dialog's own focusing steps.
      closeRef.current?.focus();
    }
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
            enlarged text. In a narrow sheet (320px with 200% text) its side padding tightens
            so every nav label sits whole beside its icon. */}
        <FadeScroll className="h-full overflow-y-auto @container/sheet">
          <div className="flex min-h-full flex-col gap-6 px-3 py-4 *:shrink-0 @max-[12rem]/sheet:px-2">
            {/* The wordmark and workspace name share a row with the close button while the
                sheet has room for them (15rem, so enlarged text needs more); narrower, the
                close button keeps the top corner and they take the full row beneath it, so
                the wordmark keeps its size and "Workspace" stays whole. */}
            <div className="@container">
              <div className="flex flex-col-reverse items-end gap-1 @[15rem]:flex-row @[15rem]:items-start @[15rem]:justify-between @[15rem]:gap-2">
                {/* The wordmark sizes itself to this block (a size container). */}
                <div className="w-full min-w-0 self-stretch pl-3 @container @[15rem]:w-auto @[15rem]:flex-1 @[15rem]:self-auto @[15rem]:pt-2">
                  <Wordmark fit />
                  <span className="mt-1 block break-words text-xs text-ink-3">{workspaceName}</span>
                </div>
                <IconButton ref={closeRef} autoFocus label="Close navigation menu" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" aria-hidden="true" />
                </IconButton>
              </div>
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
