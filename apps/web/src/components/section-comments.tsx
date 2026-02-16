"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Copy, MessageSquarePlus, RotateCcw, Trash2 } from "lucide-react";

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

function formatTime(ts: string) {
  const dt = new Date(ts);
  return dt.toLocaleString();
}

export function SectionComments({
  albumId,
  section,
}: {
  albumId: string;
  section: {
    id: string;
    songTrackNumber: number;
    sectionType: string;
    sectionOrder: number;
  };
}) {
  const sectionId = section.id;
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const header = useMemo(() => {
    return `Track ${section.songTrackNumber} · ${section.sectionType} #${section.sectionOrder + 1}`;
  }, [section.songTrackNumber, section.sectionOrder, section.sectionType]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/albums/${albumId}/comments?sectionId=${encodeURIComponent(sectionId)}`,
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Failed to load comments (${response.status}).`);
      }
      const payload = (await response.json().catch(() => null)) as
        | { comments?: SectionComment[] }
        | null;
      setComments(Array.isArray(payload?.comments) ? payload!.comments! : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load comments.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [albumId, sectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setStatus(null);
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
        const text = await response.text().catch(() => "");
        throw new Error(text || `Failed to create comment (${response.status}).`);
      }
      setBody("");
      setStatus("Comment added.");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create comment.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function patch(commentId: string, payload: unknown) {
    const response = await fetch(`/api/albums/${albumId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Request failed (${response.status}).`);
    }
  }

  async function resolve(commentId: string) {
    setError(null);
    setStatus(null);
    try {
      await patch(commentId, { action: "resolve" });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resolve comment.";
      setError(message);
    }
  }

  async function unresolve(commentId: string) {
    setError(null);
    setStatus(null);
    try {
      await patch(commentId, { action: "unresolve" });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unresolve comment.";
      setError(message);
    }
  }

  async function remove(commentId: string) {
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Delete failed (${response.status}).`);
      }
      setStatus("Comment deleted.");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete comment.";
      setError(message);
    }
  }

  async function makeTask(comment: SectionComment) {
    setError(null);
    setStatus(null);
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
        const text = await response.text().catch(() => "");
        throw new Error(text || `Failed to create task (${response.status}).`);
      }
      setStatus("Task created.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create task.";
      setError(message);
    }
  }

  async function copyLink() {
    try {
      const url = new URL(`${window.location.origin}/app/albums/${albumId}/studio`);
      url.searchParams.set("song", String(section.songTrackNumber));
      url.searchParams.set("section", String(section.sectionOrder));
      url.searchParams.set("sid", sectionId);
      await navigator.clipboard.writeText(url.toString());
      setStatus("Copied section link.");
      window.setTimeout(() => setStatus(null), 1400);
    } catch {
      setError("Unable to copy link.");
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Collaboration</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text)]">Comments</div>
          <div className="mt-1 text-xs text-[var(--muted2)]">{header}</div>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        >
          <Copy className="h-4 w-4" />
          Copy link
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="text-xs text-[var(--muted2)]">Loading comments…</div>
        ) : comments.length ? (
          <div className="max-h-[260px] overflow-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)]">
            <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
              {comments.map((comment) => {
                const isDeleted = Boolean(comment.deletedAt);
                const isResolved = Boolean(comment.resolvedAt);
                return (
                  <li key={comment.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-xs font-semibold text-[var(--text)]">
                            {comment.author.name || "User"}
                          </div>
                          <div className="text-[10px] text-[var(--muted2)]">
                            {formatTime(comment.createdAt)}
                          </div>
                          {isResolved ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-[rgba(50,213,131,0.14)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ok)]">
                              <CheckCircle2 className="h-3 w-3" />
                              Resolved
                            </div>
                          ) : null}
                          {isDeleted ? (
                            <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted2)]">
                              Deleted
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted)]">
                          {isDeleted ? "[deleted]" : comment.body}
                        </div>
                      </div>

                      {!isDeleted ? (
                        <div className="flex flex-none items-center gap-1 text-[var(--muted)]">
                          <button
                            type="button"
                            onClick={() => void makeTask(comment)}
                            className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
                            aria-label="Create task"
                            title="Create task"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                          </button>
                          {isResolved ? (
                            <button
                              type="button"
                              onClick={() => unresolve(comment.id)}
                              className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
                              aria-label="Unresolve"
                              title="Unresolve"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => resolve(comment.id)}
                              className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
                              aria-label="Resolve"
                              title="Resolve"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => remove(comment.id)}
                            className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,62,165,0.14)]"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-6 text-center text-xs text-[var(--muted2)]">
            No comments yet.
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-[var(--text)]">Add comment</div>
          <div className="text-[10px] text-[var(--muted2)]">{body.trim().length}/2000</div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="mt-2 w-full resize-y rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-xs leading-relaxed text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
          placeholder="Leave feedback for this section…"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] text-[var(--muted2)]">
            Tip: write concrete notes (what to change + why).
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || body.trim().length < 2}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MessageSquarePlus className="h-4 w-4" />
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>

        {status ? <div className="mt-2 text-[10px] text-[var(--muted2)]">{status}</div> : null}
        {error ? <div className="mt-2 text-[10px] text-[var(--muted2)]">{error}</div> : null}
      </div>
    </div>
  );
}
