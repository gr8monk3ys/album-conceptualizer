"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";

import { Button } from "@/components/ui";
import { useReturnFocus } from "@/components/use-return-focus";

function credits(n: number) {
  return `${n} ${n === 1 ? "credit" : "credits"}`;
}

/**
 * What the open confirm asks, and whether the balance covers the spend. `question` is the
 * action as a question without its cost ("Create the album"); without one the question is
 * built from the confirm button's verb ("Remix for 5 credits?"), as it always has been.
 */
export function spendPrompt({
  cost,
  remaining,
  actionLabel,
  question,
}: {
  cost: number;
  remaining?: number;
  actionLabel: string;
  question?: string;
}): { text: string; affordable: boolean } {
  const ask = question ?? actionLabel;
  if (typeof remaining !== "number") return { text: `${ask} for ${credits(cost)}?`, affordable: true };
  const after = remaining - cost;
  if (after >= 0) return { text: `${ask} for ${credits(cost)}? You'll have ${after} left.`, affordable: true };
  return {
    text: question
      ? `${question}? It costs ${credits(cost)} and you have ${credits(remaining)}.`
      : `${actionLabel} costs ${credits(cost)} and you have ${credits(remaining)}.`,
    affordable: false,
  };
}

/**
 * The open confirm: the question, the spend and Cancel. Focus moves to the spend button when
 * it opens, so that button is never natively disabled (a disabled button can't hold focus,
 * which would drop to the page): when the balance doesn't cover the spend it is marked
 * unavailable (aria-disabled, ignoring presses) and the question says why.
 */
export function SpendConfirm({
  groupId,
  promptId,
  prompt,
  actionLabel,
  working,
  confirmRef,
  onConfirm,
  onCancel,
}: {
  groupId: string;
  promptId: string;
  prompt: { text: string; affordable: boolean };
  actionLabel: string;
  working: boolean;
  confirmRef?: Ref<HTMLButtonElement>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      id={groupId}
      role="group"
      aria-labelledby={promptId}
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p id={promptId} className="text-sm text-ink">
        {prompt.text}
      </p>
      <Button
        ref={confirmRef}
        tone="primary"
        aria-disabled={prompt.affordable ? undefined : true}
        busy={working}
        onClick={prompt.affordable ? onConfirm : undefined}
      >
        {working ? "Working…" : actionLabel}
      </Button>
      <Button tone="ghost" onClick={onCancel} disabled={working}>
        Cancel
      </Button>
    </div>
  );
}

/**
 * A credit spend that asks once. The trigger opens a small inline confirm (not a modal) naming
 * the cost and, when the page knows it, the balance after; the spend happens only on the second,
 * explicit choice, so a mis-tap never costs credits. Escape or Cancel closes it and returns
 * focus to the trigger. Pass `remaining` whenever the page has the balance.
 *
 * Focus never drops to the page: while the spend runs, the confirm stays focused and busy
 * (`Button busy`, so a second press can't spend twice), and when it is done on a screen that
 * stays, the confirm closes and focus goes back to the trigger, after the close has committed
 * (`useReturnFocus`, which also survives the `router.refresh()` a spend usually makes). If the
 * spend navigates away, there is nothing to return to and nothing is done.
 */
export function ConfirmSpend({
  cost,
  remaining,
  actionLabel,
  question,
  onConfirm,
  busy = false,
  disabled = false,
  tone = "secondary",
  className,
  describedBy,
  children,
}: {
  cost: number;
  /** The balance before the spend; without it the question names only the cost. */
  remaining?: number;
  /** The verb on the confirm button, e.g. "Remix" or "Download zip". */
  actionLabel: string;
  /**
   * The question the confirm asks, without the cost, when the button's verb doesn't read as
   * one: "Create the album" asks "Create the album for 5 credits?" over "Save and continue".
   */
  question?: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  /** The trigger's tone; the confirm button is always the primary. */
  tone?: "primary" | "secondary" | "ghost";
  className?: string;
  /**
   * The id of a line that explains the trigger (why it is unavailable, what it costs), so the
   * trigger is described by it.
   */
  describedBy?: string;
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
  const returnFocus = useReturnFocus();
  const prompt = spendPrompt({ cost, remaining, actionLabel, question });
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
    returnFocus(() => triggerRef.current);
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
        aria-describedby={describedBy}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
    );
  }

  return (
    <SpendConfirm
      groupId={groupId}
      promptId={promptId}
      prompt={prompt}
      actionLabel={actionLabel}
      working={working}
      confirmRef={confirmRef}
      onConfirm={confirm}
      onCancel={close}
    />
  );
}
