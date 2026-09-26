"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui";

function credits(n: number) {
  return `${n} ${n === 1 ? "credit" : "credits"}`;
}

/**
 * A credit spend that asks once. The trigger opens a small inline confirm (not a modal) naming
 * the cost and, when the page knows it, the balance after; the spend happens only on the second,
 * explicit choice, so a mis-tap never costs credits. Escape or Cancel closes it and returns
 * focus to the trigger. Pass `remaining` whenever the page has the balance.
 *
 * Focus never drops to the page: while the spend runs, the confirm stays focused and busy
 * (`Button busy`, so a second press can't spend twice), and when it is done on a screen that
 * stays, the confirm closes and focus goes back to the trigger. If the spend navigates away,
 * there is nothing to return to and nothing is done.
 */
export function ConfirmSpend({
  cost,
  remaining,
  actionLabel,
  onConfirm,
  busy = false,
  disabled = false,
  tone = "secondary",
  className,
  children,
}: {
  cost: number;
  /** The balance before the spend; without it the question names only the cost. */
  remaining?: number;
  /** The verb on the confirm button, e.g. "Remix" or "Download zip". */
  actionLabel: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  /** The trigger's tone; the confirm button is always the primary. */
  tone?: "primary" | "secondary" | "ghost";
  className?: string;
  /** The trigger's label. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // The spend this confirm started, until it settles, so the confirm is busy even when the
  // caller doesn't pass `busy`.
  const [pending, setPending] = useState(false);
  const promptId = useId();
  const groupId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const mounted = useRef(false);
  const known = typeof remaining === "number";
  const after = known ? remaining - cost : null;
  const affordable = after === null || after >= 0;
  const working = busy || pending;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      if (mounted.current) setPending(false);
    }
    // Still on this screen (a spend that navigates has unmounted it): close and hand focus
    // back to the trigger, as Cancel does.
    if (mounted.current) close();
  }

  if (!open) {
    return (
      // The trigger discloses the confirm in its own place: collapsed, it names the group it
      // opens (not a menu, so no aria-haspopup). Busy rather than disabled while a spend runs,
      // so it keeps focus.
      <Button
        ref={triggerRef}
        tone={tone}
        className={className}
        disabled={disabled}
        busy={busy}
        aria-expanded={false}
        aria-controls={groupId}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
    );
  }

  return (
    <div
      id={groupId}
      role="group"
      aria-labelledby={promptId}
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <p id={promptId} className="text-sm text-ink">
        {after === null
          ? `${actionLabel} for ${credits(cost)}?`
          : affordable
            ? `${actionLabel} for ${credits(cost)}? You'll have ${after} left.`
            : `${actionLabel} costs ${credits(cost)} and you have ${credits(remaining ?? 0)}.`}
      </p>
      <Button ref={confirmRef} tone="primary" disabled={!affordable} busy={working} onClick={confirm}>
        {working ? "Working…" : actionLabel}
      </Button>
      <Button tone="ghost" onClick={close} disabled={working}>
        Cancel
      </Button>
    </div>
  );
}
