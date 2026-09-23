"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Copy, MessageSquarePlus, RotateCcw, Trash2 } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import { readApiError } from "@/components/studio/studio-model";
import { Button, Chip, IconButton, textareaClass } from "@/components/ui";

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
  };
};

const MAX_LENGTH = 2000;

function excerpt(body: string) {
  const line = body.trim().split(/\s+/g).join(" ");
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

function useSectionCommentsRender({ albumId, section }: SectionCommentsProps) {
  const sectionId = section.id;
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [ui, setUi] = useState<SectionCommentsUiState>({
    loading: false,
    submitting: false,
    body: "",
    status: null,
    error: null,
  });
  const { loading, submitting, body, status, error } = ui;

  const header = `Track ${section.songTrackNumber} · ${section.label ?? `Section ${section.sectionOrder + 1}`}`;
  const inputId = `comment-body-${sectionId}`;

  async function refresh() {
    setUi((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`/api/albums/${albumId}/comments?sectionId=${encodeURIComponent(sectionId)}`);
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't load comments. Reload the page to try again."));
      }
      const payload = (await response.json().catch(() => null)) as { comments?: SectionComment[] } | null;
      setComments(Array.isArray(payload?.comments) ? payload.comments : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load comments.";
      setUi((prev) => ({ ...prev, error: message }));
    } finally {
      setUi((prev) => ({ ...prev, loading: false }));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId, sectionId]);

  async function submit() {
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
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't post the comment. Try again.";
      setUi((prev) => ({ ...prev, status: null, error: message }));
    } finally {
      setUi((prev) => ({ ...prev, submitting: false }));
    }
  }

  async function patch(commentId: string, payload: unknown, failure: string) {
    const response = await fetch(`/api/albums/${albumId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiError(response, failure));
  }

  async function resolve(commentId: string) {
    setUi((prev) => ({ ...prev, error: null, status: null }));
    try {
      await patch(commentId, { action: "resolve" }, "Couldn't resolve the comment. Try again.");
      setUi((prev) => ({ ...prev, status: "Comment resolved." }));
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resolve the comment.";
      setUi((prev) => ({ ...prev, error: message }));
    }
  }

  async function unresolve(commentId: string) {
    setUi((prev) => ({ ...prev, error: null, status: null }));
    try {
      await patch(commentId, { action: "unresolve" }, "Couldn't reopen the comment. Try again.");
      setUi((prev) => ({ ...prev, status: "Comment reopened." }));
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't reopen the comment.";
      setUi((prev) => ({ ...prev, error: message }));
    }
  }

  async function remove(commentId: string) {
    setUi((prev) => ({ ...prev, error: null, status: null }));
    try {
      const response = await fetch(`/api/albums/${albumId}/comments/${commentId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't delete the comment. Try again."));
      }
      setUi((prev) => ({ ...prev, status: "Comment deleted." }));
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't delete the comment.";
      setUi((prev) => ({ ...prev, error: message }));
    }
  }

  async function makeTask(comment: SectionComment) {
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
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't create the task. Try again."));
      }
      setUi((prev) => ({ ...prev, status: "Task created. Find it in Comments and tasks on the Overview." }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't create the task.";
      setUi((prev) => ({ ...prev, error: message }));
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

  return (
    <section aria-labelledby={`comments-${sectionId}-title`} className="border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`comments-${sectionId}-title`} className="text-base font-semibold text-ink">
            Comments
          </h3>
          <p className="mt-1 text-sm text-ink-2">{header}</p>
        </div>
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
              return (
                <li key={comment.id} className="flex items-start justify-between gap-3 py-3">
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
                          Resolved
                        </Chip>
                      ) : null}
                      {isDeleted ? <Chip>Deleted</Chip> : null}
                    </div>
                    <p className="mt-1.5 max-w-[65ch] whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">
                      {isDeleted ? "This comment was deleted." : comment.body}
                    </p>
                  </div>

                  {!isDeleted ? (
                    <div className="flex flex-none items-center">
                      <IconButton label={`Create task from ${about}`} title="Create task" onClick={() => void makeTask(comment)}>
                        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      {isResolved ? (
                        <IconButton label={`Reopen ${about}`} title="Reopen" onClick={() => void unresolve(comment.id)}>
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      ) : (
                        <IconButton label={`Resolve ${about}`} title="Resolve" onClick={() => void resolve(comment.id)}>
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )}
                      <IconButton
                        label={`Delete ${about}`}
                        title="Delete comment"
                        onClick={() => void remove(comment.id)}
                        className="hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  ) : null}
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
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            Add a comment
          </label>
          <span id={`${inputId}-count`} className="type-figure text-xs text-ink-3">
            {length}/{MAX_LENGTH}
          </span>
        </div>
        <textarea
          id={inputId}
          value={body}
          onChange={(e) => setUi((prev) => ({ ...prev, body: e.target.value }))}
          rows={3}
          maxLength={MAX_LENGTH}
          aria-describedby={`${inputId}-hint ${inputId}-count`}
          className={textareaClass}
          placeholder="What should change, and why?"
        />
        <p id={`${inputId}-hint`} className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
          Concrete notes work best: what to change and why.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          {/* Both regions stay mounted so each change is announced. */}
          <div className="min-w-0">
            <p role="status" className={submitting ? "text-sm text-ink-2" : "text-sm text-ok"}>
              {status && !error ? status : ""}
            </p>
            <p role="alert" className="text-sm text-danger">
              {error ?? ""}
            </p>
          </div>
          <Button tone="secondary" onClick={() => void submit()} disabled={submitting || length < 2}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SectionComments(props: SectionCommentsProps) {
  return useSectionCommentsRender(props);
}
