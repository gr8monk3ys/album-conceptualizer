"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui";

function credits(n: number) {
  return `${n} ${n === 1 ? "credit" : "credits"}`;
}

/**
 * A credit spend that asks once. The trigger opens a small inline confirm (not a modal) naming
 * the cost and the balance after; the spend happens only on the second, explicit choice, so a
 * mis-tap never costs credits. Escape or Cancel closes it and returns focus to the trigger.
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
  remaining: number;
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
  const promptId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const after = remaining - cost;
  const affordable = after >= 0;

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (!open) {
    return (
      <Button
        ref={triggerRef}
        tone={tone}
        className={className}
        disabled={disabled || busy}
        aria-haspopup="true"
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
    );
  }

  return (
    <div
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
        {affordable
          ? `${actionLabel} for ${credits(cost)}? You'll have ${after} left.`
          : `${actionLabel} costs ${credits(cost)} and you have ${credits(remaining)}.`}
      </p>
      <Button
        ref={confirmRef}
        tone="primary"
        disabled={!affordable || busy}
        onClick={async () => {
          await onConfirm();
          setOpen(false);
        }}
      >
        {busy ? "Working…" : actionLabel}
      </Button>
      <Button tone="ghost" onClick={close} disabled={busy}>
        Cancel
      </Button>
    </div>
  );
}
