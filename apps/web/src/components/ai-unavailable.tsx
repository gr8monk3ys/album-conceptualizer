"use client";

import { useEffect, useId, useSyncExternalStore } from "react";

import { AI_UNAVAILABLE_MESSAGE } from "@/lib/ai";
import { cn } from "@/lib/utils";

// When AI can't run on this server, a screen says so once. Every AI slot on the screen keeps
// its button (disabled, still priced), but only the first slot mounted prints the plain line;
// the others point their button's description at it. A tiny module-level registry decides who
// goes first, so no page has to wrap its AI slots in a provider.

const slots: string[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function firstSlot() {
  return slots[0] ?? null;
}

function emit() {
  for (const listener of listeners) listener();
}

/**
 * For one AI slot: whether it prints the unavailable line (`show`), the id its button's
 * `aria-describedby` should use (`describedBy`, the line wherever it is), and the id to give
 * the line when this slot prints it (`noticeId`). Inactive (AI available) slots don't register.
 */
export function useAiUnavailableNotice(active: boolean) {
  const noticeId = `ai-unavailable-${useId()}`;

  useEffect(() => {
    if (!active) return;
    slots.push(noticeId);
    emit();
    return () => {
      const index = slots.indexOf(noticeId);
      if (index >= 0) slots.splice(index, 1);
      emit();
    };
  }, [active, noticeId]);

  const owner = useSyncExternalStore(subscribe, firstSlot, () => null);
  // Before the slots have registered (the server render, the first paint) each slot shows
  // the line; once they have, only the first one does.
  const show = active && (owner === null || owner === noticeId);
  return { show, noticeId, describedBy: active ? (owner ?? noticeId) : undefined };
}

/** The one plain line, for the slot whose `show` is true. */
export function AiUnavailableNote({ id, className }: { id: string; className?: string }) {
  return (
    <p id={id} className={cn("max-w-[65ch] text-sm leading-relaxed text-ink-2", className)}>
      {AI_UNAVAILABLE_MESSAGE}
    </p>
  );
}
