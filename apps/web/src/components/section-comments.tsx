"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ClipboardCheck, Copy, MessageSquarePlus, RotateCcw, Trash2 } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import { DeleteConfirm } from "@/components/studio/delete-confirm";
import { readApiError } from "@/components/studio/studio-model";
import { Button, Chip, textareaClass } from "@/components/ui";
import { useReturnFocus } from "@/components/use-return-focus";
import { sectionPlaceLine, sectionPlacePhrase } from "@/lib/section-place";
import { cn } from "@/lib/utils";

type CommentAuthor = {
  id: string;
  name: string | null;
  image: string | null;
};

type SectionComment = {
  id: string;
  sectionId: string;
  songTrackNumber: number;
  sectionType: string;
  sectionOrder: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  resolvedAt: string | null;
  author: CommentAuthor;
  resolvedBy: CommentAuthor | null;
  /**
   * How the comment stands with the task made from it (server/comment-tasks.ts): "open" while
   * that task is open (the comment is tracked as the task, with no Resolve of its own), "done"
   * once it is done (which resolved the comment), null without a task.
   */
  task?: "open" | "done" | null;
};

type SectionCommentsUiState = {
  loading: boolean;
  submitting: boolean;
  body: string;
  status: string | null;
  error: string | null;
};

type SectionCommentsProps = {
  albumId: string;
  section: {
    id: string;
    songTrackNumber: number;
    sectionType: string;
    sectionOrder: number;
    /** The section's display label, e.g. "Chorus 2", the same one the Studio shows. */
    label?: string;
    /** The track's title, so the thread is named as the spine names it ("01 · Low Tide Leaving · Verse 1"). */
    songTitle?: string | null;
  };
  /** Start expanded, e.g. when the page was opened from a link to this section's comments. */
  defaultOpen?: boolean;
};

const MAX_LENGTH = 2000;
// A single stray keystroke isn't a note; the hint under the field says so.
const MIN_LENGTH = 2;
/** The length counter appears only once a comment gets close to the limit. */
const COUNTER_FROM = 1800;

function excerpt(body: string) {
  const line = body.trim().split(/\s+/g).join(" ");
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

/** A comment action running: presses on any of its buttons are ignored until it finishes. */
type PendingAction = "task" | "resolve" | "reopen" | "delete";

/** The ids of a comment's row and its actions, so focus can come back to them after a refresh. */
const rowId = (commentId: string) => `comment-${commentId}`;
const actionId = (commentId: string, action: "task" | "task-done" | "resolve" | "reopen" | "delete") =>
  `comment-${commentId}-${action}`;

function useSectionCommentsRender({ albumId, section, defaultOpen = false }: SectionCommentsProps) {
  const sectionId = section.id;
  const [open, setOpen] = useState(defaultOpen);
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [ui, setUi] = useState<SectionCommentsUiState>({
    loading: false,
    submitting: false,
    body: "",
    status: null,
    error: null,
  });
  const { loading, submitting, body, status, error } = ui;
  // The comment each action is running on, the comments given a task since the thread last
  // loaded (the server says which had one before), and the comment whose inline "Delete …?"
  // question is open.
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [tasked, setTasked] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  // Post was pressed with too little to post: the status line says why until there is enough.
  const [tooShort, setTooShort] = useState(false);
  const returnFocus = useReturnFocus();
  // The same guard without waiting for a render, so a double press never sends twice.
  const inFlight = useRef(new Set<string>());

  const place = {
    trackNumber: section.songTrackNumber,
    songTitle: section.songTitle,
    sectionLabel: section.label ?? `Section ${section.sectionOrder + 1}`,
  };
  // "01 · Low Tide Leaving · Verse 1", and "Low Tide Leaving, Verse 1" inside a sentence.
  const header = sectionPlaceLine(place);
  const phrase = sectionPlacePhrase(place);
  const inputId = `comment-body-${sectionId}`;
  const postId = `comment-post-${sectionId}`;

  async function refresh() {
    setUi((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`/api/albums/${albumId}/comments?sectionId=${encodeURIComponent(sectionId)}`);
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't load comments. Reload the page to try again."));
      }
      const payload = (await response.json().catch(() => null)) as { comments?: SectionComment[] } | null;
      const loaded = Array.isArray(payload?.comments) ? payload.comments : [];
      setComments(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load comments.";
      setUi((prev) => ({ ...prev, error: message }));
    } finally {
      setUi((prev) => ({ ...prev, loading: false }));
    }
  }

  function setPendingFor(commentId: string, action: PendingAction | null) {
    if (action) inFlight.current.add(commentId);
    else inFlight.current.delete(commentId);
    setPending((prev) => {
      const next = { ...prev };
      if (action) next[commentId] = action;
      else delete next[commentId];
      return next;
    });
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId, sectionId]);

  async function submit() {
    if (submitting) return;
    if (length < MIN_LENGTH) {
      setUi((prev) => ({ ...prev, error: null, status: null }));
      setTooShort(true);
      return;
    }
    setTooShort(false);
    const fromButton = document.activeElement?.id === postId;
    setUi((prev) => ({ ...prev, submitting: true, error: null, status: "Posting comment…" }));
    try {
      const response = await fetch(`/api/albums/${albumId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sectionId,
          songTrackNumber: section.songTrackNumber,
          sectionType: section.sectionType,
          sectionOrder: section.sectionOrder,
          body,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't post the comment. Try again."));
      }
      setUi((prev) => ({ ...prev, body: "", status: "Comment added." }));
      // The cleared composer leaves Post unavailable: focus goes back to it for the next note.
      if (fromButton) document.getElementById(inputId)?.focus();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't post the comment. Try again.";
      setUi((prev) => ({ ...prev, status: null, error: message }));
    } finally {
      setUi((prev) => ({ ...prev, submitting: false }));
    }
  }

  /** PATCHes the comment; true when its task changed with it (done, or open again). */
  async function patch(commentId: string, payload: unknown, failure: string) {
    const response = await fetch(`/api/albums/${albumId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiError(response, failure));
    const data = (await response.json().catch(() => null)) as { taskChanged?: unknown } | null;
    return data?.taskChanged === true;
  }

  // Resolve and Reopen swap for each other, so focus goes to the one that replaced the button
  // pressed; a failure leaves the button where it was, with focus on it.
  async function resolve(commentId: string) {
    if (inFlight.current.has(commentId)) return;
    setPendingFor(commentId, "resolve");
    setUi((prev) => ({ ...prev, error: null, status: null }));
    try {
      const taskDone = await patch(commentId, { action: "resolve" }, "Couldn't resolve the comment. Try again.");
      await refresh();
      setUi((prev) => ({
        ...prev,
        status: taskDone ? `Resolved the comment on ${phrase} and marked its task done.` : `Resolved the comment on ${phrase}.`,
      }));
      returnFocus(() => document.getElementById(actionId(commentId, "reopen")));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resolve the comment.";
      setUi((prev) => ({ ...prev, error: message }));
    } finally {
      setPendingFor(commentId, null);
    }
  }

  async function unresolve(commentId: string) {
    if (inFlight.current.has(commentId)) return;
    setPendingFor(commentId, "reopen");
    setUi((prev) => ({ ...prev, error: null, status: null }));
    try {
      const taskReopened = await patch(commentId, { action: "unresolve" }, "Couldn't reopen the comment. Try again.");
      await refresh();
      setUi((prev) => ({
        ...prev,
        status: taskReopened ? `Reopened the comment on ${phrase} and its task.` : `Reopened the comment on ${phrase}.`,
      }));
      // A reopened comment with a task is tracked as the task again: focus goes to that link.
      returnFocus(
        () =>
          document.getElementById(actionId(commentId, "resolve")) ??
          document.getElementById(actionId(commentId, "task-done")),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't reopen the comment.";
      setUi((prev) => ({ ...prev, error: message }));
    } finally {
      setPendingFor(commentId, null);
    }
  }

  /** Delete, once the inline question is answered: the thread keeps a "deleted" marker, focused. */
  async function remove(commentId: string) {
    // Something else on this comment is still running: close the question, focus back on Delete.
    if (inFlight.current.has(commentId)) return cancelDelete(commentId);
    setConfirmingDelete(null);
    setPendingFor(commentId, "delete");
    // The question closes on its Delete; focus waits on the (busy) Delete it came from.
    returnFocus(() => document.getElementById(actionId(commentId, "delete")));
    setUi((prev) => ({ ...prev, error: null, status: null }));
    try {
      const response = await fetch(`/api/albums/${albumId}/comments/${commentId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't delete the comment. Try again."));
      }
      await refresh();
      setUi((prev) => ({ ...prev, status: `Deleted the comment on ${phrase}.` }));
      returnFocus(() => document.getElementById(rowId(commentId)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't delete the comment.";
      setUi((prev) => ({ ...prev, error: message }));
      returnFocus(() => document.getElementById(actionId(commentId, "delete")));
    } finally {
      setPendingFor(commentId, null);
    }
  }

  /** Cancel or Escape on the delete question: nothing deleted, focus back on Delete. */
  function cancelDelete(commentId: string) {
    setConfirmingDelete(null);
    returnFocus(() => document.getElementById(actionId(commentId, "delete")));
  }

  /** One task per comment: busy while it's created, then "Tracked as a task" in the button's place. */
  async function makeTask(comment: SectionComment) {
    if (inFlight.current.has(comment.id) || tasked.has(comment.id) || comment.task) return;
    setPendingFor(comment.id, "task");
    setUi((prev) => ({ ...prev, error: null, status: null }));
    try {
      const titleBase = comment.body.trim().split(/\n+/g)[0] ?? "Review comment";
      const title = titleBase.length > 90 ? `${titleBase.slice(0, 90)}…` : titleBase;
      const response = await fetch(`/api/albums/${albumId}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          body: comment.body,
          sourceCommentId: comment.id,
          sectionId,
          songTrackNumber: section.songTrackNumber,
          sectionType: section.sectionType,
          sectionOrder: section.sectionOrder,
        }),
      });
      // 409: this comment already has a task (another tab, or a press that got lost on the way
      // back). That is the outcome asked for, so it shows as made, not as a failure.
      const already = response.status === 409;
      if (!response.ok && !already) {
        throw new Error(await readApiError(response, "Couldn't create the task. Try again."));
      }
      setTasked((prev) => new Set([...prev, comment.id]));
      setUi((prev) => ({
        ...prev,
        status: already
          ? "This comment already has a task. Find it in Comments and tasks on the Overview."
          : "Task created. Find it in Comments and tasks on the Overview.",
      }));
      returnFocus(() => document.getElementById(actionId(comment.id, "task-done")));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't create the task.";
      setUi((prev) => ({ ...prev, error: message }));
    } finally {
      setPendingFor(comment.id, null);
    }
  }

  async function copyLink() {
    try {
      const url = new URL(`${window.location.origin}/app/albums/${albumId}/studio`);
      url.searchParams.set("song", String(section.songTrackNumber));
      url.searchParams.set("section", String(section.sectionOrder));
      url.searchParams.set("sid", sectionId);
      await navigator.clipboard.writeText(url.toString());
      setUi((prev) => ({ ...prev, error: null, status: "Link to this section copied." }));
    } catch {
      setUi((prev) => ({ ...prev, error: "Couldn't copy the link. Copy it from the address bar instead." }));
    }
  }

  const length = body.trim().length;
  const showCounter = body.length >= COUNTER_FROM;
  // Deleted comments stay in the thread as a marker but don't count.
  const count = comments.filter((comment) => !comment.deletedAt).length;
  const openCount = comments.filter((comment) => !comment.deletedAt && !comment.resolvedAt).length;
  const bodyId = `comments-${sectionId}-body`;

  // Collapsed to one quiet line under the writing surface: "Comments (2)". Opening it shows
  // the thread, the composer and the section link.
  return (
    <section aria-labelledby={`comments-${sectionId}-title`} className="border-t border-line pt-3">
      <h3 id={`comments-${sectionId}-title`} className="text-base text-ink">
        <button
          id={`comments-${sectionId}-toggle`}
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="-mx-2 inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-2 rounded px-2 text-left transition-colors hover:bg-hover"
        >
          <span className="font-semibold">
            Comments{" "}
            <span className="type-figure font-normal text-ink-2">
              {/* No count until it is known: "(0)" while loading or after a failed load would be untrue. */}
              {!comments.length && (loading || error) ? "" : `(${count})`}
            </span>
          </span>
          {openCount && openCount !== count ? (
            <span className="type-figure text-sm text-ink-2">· {openCount} open</span>
          ) : null}
          <ChevronDown className={cn("h-4 w-4 text-ink-2 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
        </button>
      </h3>

      <div id={bodyId} hidden={!open}>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-ink-2">{header}</p>
        <Button tone="ghost" onClick={() => void copyLink()}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy link
        </Button>
      </div>

      <div className="mt-3">
        {loading && !comments.length ? (
          <p className="text-sm text-ink-3">Loading comments…</p>
        ) : comments.length ? (
          <ul className="max-h-80 divide-y divide-line overflow-auto border-y border-line">
            {comments.map((comment) => {
              const isDeleted = Boolean(comment.deletedAt);
              const isResolved = Boolean(comment.resolvedAt);
              // Each comment's buttons name the comment they act on, so the names stay unique.
              const about = `${comment.author.name || "Collaborator"}’s comment “${excerpt(comment.body)}”`;
              const busy = pending[comment.id];
              // What the server said, or "open" for a task made since the thread loaded.
              const task = comment.task ?? (tasked.has(comment.id) ? "open" : null);
              const tracked = task === "open" && !isResolved;
              // Labelled actions under the comment (they wrap at 320px with 200% text), each
              // named after the comment it acts on so the names stay unique.
              return (
                <li key={comment.id} id={rowId(comment.id)} tabIndex={-1} className="py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="min-w-0 break-words font-semibold text-ink">
                        {comment.author.name || "Collaborator"}
                      </span>
                      <span className="text-ink-3">
                        <RelativeTime date={comment.createdAt} />
                      </span>
                      {isResolved ? (
                        <Chip tone="ok">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          {task === "done" ? "Resolved · task done" : "Resolved"}
                        </Chip>
                      ) : null}
                      {isDeleted ? <Chip>Deleted</Chip> : null}
                    </div>
                    <p className="mt-1.5 max-w-[65ch] whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">
                      {isDeleted ? "This comment was deleted." : comment.body}
                    </p>
                  </div>

                  {isDeleted ? null : confirmingDelete === comment.id ? (
                    // Asked inline, like the Studio's delete question: focus on Delete,
                    // Escape or Cancel back to the Delete that asked.
                    <DeleteConfirm
                      id={`comment-${comment.id}-delete-confirm`}
                      question={`Delete ${comment.author.name || "this collaborator"}’s comment “${excerpt(comment.body)}”?`}
                      onConfirm={() => void remove(comment.id)}
                      onCancel={() => cancelDelete(comment.id)}
                    />
                  ) : (
                    <div className="-ml-3 mt-1 flex flex-wrap items-center">
                      {/* One note, two views: while its task is open the comment is tracked as
                          that task, a link to it, and is resolved by marking the task done; a
                          resolved note is no one's to-do, so it offers only Reopen. */}
                      {tracked ? (
                        <Link
                          id={actionId(comment.id, "task-done")}
                          href={`/app/albums/${albumId}/inbox#inbox-tasks`}
                          aria-label={`Tracked as a task: ${about}. Open Comments and tasks`}
                          className="inline-flex min-h-11 items-center gap-2 rounded px-3 text-sm text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:bg-hover hover:text-ink hover:decoration-ink"
                        >
                          <ClipboardCheck className="h-4 w-4 text-ink-3" aria-hidden="true" />
                          Tracked as a task
                        </Link>
                      ) : isResolved ? (
                        <Button
                          id={actionId(comment.id, "reopen")}
                          tone="ghost"
                          className="px-3"
                          busy={busy === "reopen"}
                          aria-label={`Reopen ${about}${task === "done" ? " and its task" : ""}`}
                          onClick={() => void unresolve(comment.id)}
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          {busy === "reopen" ? "Reopening…" : "Reopen"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            id={actionId(comment.id, "task")}
                            tone="ghost"
                            className="px-3"
                            busy={busy === "task"}
                            aria-label={`${busy === "task" ? "Creating task" : "Create task"} from ${about}`}
                            onClick={() => void makeTask(comment)}
                          >
                            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                            {busy === "task" ? "Creating task…" : "Create task"}
                          </Button>
                          <Button
                            id={actionId(comment.id, "resolve")}
                            tone="ghost"
                            className="px-3"
                            busy={busy === "resolve"}
                            aria-label={`Resolve ${about}`}
                            onClick={() => void resolve(comment.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            {busy === "resolve" ? "Resolving…" : "Resolve"}
                          </Button>
                        </>
                      )}
                      <Button
                        id={actionId(comment.id, "delete")}
                        tone="ghost"
                        className="px-3 text-danger hover:bg-danger-soft hover:text-danger"
                        busy={busy === "delete"}
                        // Unavailable while another action on this comment runs, so the question
                        // can't open over it (its buttons would replace the one under focus).
                        aria-disabled={busy ? true : undefined}
                        aria-label={`Delete ${about}`}
                        onClick={() => {
                          if (!inFlight.current.has(comment.id)) setConfirmingDelete(comment.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {busy === "delete" ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="max-w-[65ch] text-sm text-ink-2">
            No comments on this section yet. Notes you leave here stay with it.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            Add a comment
          </label>
          {showCounter ? (
            <span id={`${inputId}-count`} className="type-figure text-xs text-ink-3">
              {body.length}/{MAX_LENGTH}
            </span>
          ) : null}
        </div>
        <textarea
          id={inputId}
          value={body}
          onChange={(e) => {
            const next = e.target.value;
            setUi((prev) => ({ ...prev, body: next }));
            if (tooShort && next.trim().length >= MIN_LENGTH) setTooShort(false);
          }}
          rows={3}
          maxLength={MAX_LENGTH}
          aria-describedby={showCounter ? `${inputId}-hint ${inputId}-count` : `${inputId}-hint`}
          className={textareaClass}
        />
        <p id={`${inputId}-hint`} className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
          Concrete notes work best: what to change and why. A comment needs at least{" "}
          {MIN_LENGTH} characters.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          {/* Both regions stay mounted so each change is announced. */}
          <div className="min-w-0">
            <p
              role="status"
              className={submitting || tooShort ? "text-sm text-ink-2" : "text-sm text-ok"}
            >
              {tooShort
                ? length
                  ? `Add a little more: a comment needs at least ${MIN_LENGTH} characters.`
                  : "Write the comment first, then post it."
                : status && !error
                  ? status
                  : ""}
            </p>
            <p role="alert" className="text-sm text-danger">
              {error ?? ""}
            </p>
          </div>
          {/* Busy while posting (focus stays), and unavailable until there's a comment to post;
              then it is described by the hint that names the minimum, and pressing it says why. */}
          <Button
            id={postId}
            tone="secondary"
            onClick={() => void submit()}
            busy={submitting}
            {...(length < MIN_LENGTH && !submitting
              ? { "aria-disabled": true, "aria-describedby": `${inputId}-hint` }
              : {})}
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
      </div>
    </section>
  );
}

export function SectionComments(props: SectionCommentsProps) {
  return useSectionCommentsRender(props);
}
