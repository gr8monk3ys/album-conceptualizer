"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";

import { Button, LiveStatus } from "@/components/ui";
import { browserFocusEnv, holdFocus } from "@/lib/focus-hold";
import { cn } from "@/lib/utils";

/** The server's human-written `error` field, or the fallback. Never a raw body or status. */
async function readError(response: Response, fallback: string) {
  if (response.status === 401) return "You're signed out. Sign in again, then retry.";
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
}

/** The one polite region the inbox's row actions announce into (see `inboxRegion`). */
const INBOX_REGION_ID = "inbox-action-status";

/**
 * A resolved comment or finished task leaves the list, and its row (with anything inside it)
 * goes with it, so the confirmation can't live in the row. The actions share one visually
 * hidden polite region on the page instead, mounted empty when the first action mounts (a
 * region that appears with its text already in it is often never read) and kept for the page.
 */
function inboxRegion(): HTMLElement {
  let region = document.getElementById(INBOX_REGION_ID);
  if (!region) {
    region = document.createElement("div");
    region.id = INBOX_REGION_ID;
    region.setAttribute("aria-live", "polite");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  return region;
}

let clearTimer: number | null = null;

function announce(text: string) {
  const region = inboxRegion();
  if (clearTimer !== null) window.clearTimeout(clearTimer);
  // Cleared first, so the same words said twice in a row are still heard the second time.
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = text;
  }, 50);
  clearTimer = window.setTimeout(() => {
    region.textContent = "";
    clearTimer = null;
  }, 6000);
}

/**
 * Where focus goes once a row leaves the list: the same action on the next row (the one before
 * it when this was the last), or the list's section heading when the list is now empty. Worked
 * out before the refresh, while the row is still there, and found again by its key after, so
 * it survives the list being re-rendered.
 */
function focusAfterRemoval(trigger: HTMLElement): () => HTMLElement | null {
  const row = trigger.closest("li");
  const neighbour = (row?.nextElementSibling ?? row?.previousElementSibling) as HTMLElement | null;
  const nextKey = neighbour?.querySelector<HTMLElement>("[data-inbox-action]")?.dataset.inboxAction;
  const headingId = trigger.closest("section[aria-labelledby]")?.getAttribute("aria-labelledby");
  return () => {
    const next = nextKey
      ? document.querySelector<HTMLElement>(`[data-inbox-action="${CSS.escape(nextKey)}"]`)
      : null;
    if (next) return next;
    const heading = headingId ? document.getElementById(headingId) : null;
    if (heading && !heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    return heading;
  };
}

/**
 * A row action that PATCHes one inbox item, then refreshes the list it belongs to. It is busy
 * (never `disabled`) while it works, so focus stays on it; when its row leaves the list, focus
 * moves to the next row's action (or the section heading) and the change is announced once.
 */
function InboxAction({
  url,
  body,
  label,
  busyLabel,
  done,
  itemLabel,
  failure,
  className,
}: {
  url: string;
  body: Record<string, unknown>;
  label: string;
  busyLabel: string;
  /** The confirmation for this item, e.g. "Resolved the comment on Low Tide Leaving, Verse 1." */
  done: (itemLabel: string) => string;
  itemLabel: string;
  failure: string;
  /** Where the action sits in its row's action column (the inbox's second slot). */
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const busy = loading || refreshing;

  // Mount the shared region empty, long before anything is said into it.
  useEffect(() => {
    inboxRegion();
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await readError(response, failure));
        return;
      }
      const trigger = buttonRef.current;
      if (trigger) {
        // Not tied to this component: the row, and this action with it, unmounts on refresh.
        holdFocus(focusAfterRemoval(trigger), browserFocusEnv());
      }
      announce(done(itemLabel));
      startRefresh(() => router.refresh());
    } catch {
      setError(`${failure} Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-1 @xl:items-stretch", className)}>
      <Button
        ref={buttonRef}
        tone="secondary"
        className="px-3 @xl:w-full"
        busy={busy}
        data-inbox-action={url}
        aria-label={`${label}: ${itemLabel}`}
        onClick={() => void run()}
      >
        <Check aria-hidden="true" className="h-4 w-4" />
        {busy ? busyLabel : label}
      </Button>
      {/* Always mounted, so a failure is announced when it arrives. */}
      <LiveStatus message={error} tone="danger" className="max-w-[65ch]" />
    </div>
  );
}

export function ResolveCommentButton({
  albumId,
  commentId,
  itemLabel = "comment",
  className,
}: {
  albumId: string;
  commentId: string;
  itemLabel?: string;
  className?: string;
}) {
  return (
    <InboxAction
      url={`/api/albums/${albumId}/comments/${commentId}`}
      body={{ action: "resolve" }}
      label="Resolve"
      busyLabel="Resolving…"
      done={(item) => `Resolved the ${item}.`}
      itemLabel={itemLabel}
      failure="Couldn't resolve this comment."
      className={className}
    />
  );
}

export function CompleteTaskButton({
  albumId,
  taskId,
  itemLabel = "task",
  fromComment = false,
  className,
}: {
  albumId: string;
  taskId: string;
  itemLabel?: string;
  /** The task was made from a comment: marking it done resolves that comment too. */
  fromComment?: boolean;
  className?: string;
}) {
  return (
    <InboxAction
      url={`/api/albums/${albumId}/tasks/${taskId}`}
      body={{ status: "done" }}
      label="Mark done"
      busyLabel="Marking done…"
      done={(item) => (fromComment ? `Marked “${item}” done and resolved its comment.` : `Marked “${item}” done.`)}
      itemLabel={itemLabel}
      failure="Couldn't mark this task done."
      className={className}
    />
  );
}
