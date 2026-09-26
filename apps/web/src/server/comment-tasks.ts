import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * One note, two views. A section comment that became a task is the same note as that task, so
 * the two never disagree about whether it is still open:
 *
 * - While its task is open, the comment is unresolved and "Tracked as a task": it is listed
 *   (and counted) once, as the task, and has no Resolve of its own.
 * - Marking the task done resolves the comment; resolving the comment marks the task done.
 * - Reopening either reopens the other: a reopened task would otherwise sit beside a comment
 *   that still says "Resolved" (two states for one note again), and a reopened comment beside
 *   a task that says "Done".
 * - Making a task from a resolved comment reopens the comment, for the same reason.
 * - Deleting the task leaves the comment as it is (still unresolved if the task was open), so
 *   it is listed as a comment again; deleting the comment leaves the task, which keeps its own
 *   title and text.
 *
 * Each change is made in the caller's transaction, beside the change that caused it.
 */

type Db = Prisma.TransactionClient | PrismaClient;

/** A task counts as open until it is done (open and in progress both count). */
export function isOpenTaskStatus(status: string) {
  return status !== "done";
}

/** Tasks still open on an album: not done, not deleted. */
export function openTaskWhere(albumId: string) {
  return { albumId, deletedAt: null, status: { not: "done" } } satisfies Prisma.AlbumTaskWhereInput;
}

/** Unresolved comments that no open task tracks: the ones listed (and counted) as comments. */
export function untrackedCommentWhere(albumId: string) {
  return {
    albumId,
    deletedAt: null,
    resolvedAt: null,
    tasks: { none: { deletedAt: null, status: { not: "done" } } },
  } satisfies Prisma.AlbumSectionCommentWhereInput;
}

/** What waits on an album, each note counted once: comments without a task, and open tasks. */
export async function openNoteCounts(db: Db, albumId: string) {
  const [comments, tasks] = await Promise.all([
    db.albumSectionComment.count({ where: untrackedCommentWhere(albumId) }),
    db.albumTask.count({ where: openTaskWhere(albumId) }),
  ]);
  return { comments, tasks };
}

/**
 * A task's status changed from `from` to `to`: its source comment follows, done resolving it
 * and a reopen reopening it. Nothing happens for a task without a comment, a deleted comment,
 * or a change between two open states (open and in progress).
 */
export async function syncCommentWithTask(
  tx: Db,
  task: { sourceCommentId: string | null; from: string; to: string },
  userId: string,
) {
  if (!task.sourceCommentId) return;
  const wasOpen = isOpenTaskStatus(task.from);
  const isOpen = isOpenTaskStatus(task.to);
  if (wasOpen === isOpen) return;
  if (!isOpen) {
    await tx.albumSectionComment.updateMany({
      where: { id: task.sourceCommentId, deletedAt: null, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedByUserId: userId },
    });
  } else {
    await tx.albumSectionComment.updateMany({
      where: { id: task.sourceCommentId, deletedAt: null, resolvedAt: { not: null } },
      data: { resolvedAt: null, resolvedByUserId: null },
    });
  }
}

/**
 * A comment was resolved or reopened: its task follows, done or open again. Returns how many
 * tasks changed (0 or 1: the server keeps one task per comment), so the caller can say so.
 */
export async function syncTaskWithComment(tx: Db, commentId: string, resolved: boolean) {
  const result = await tx.albumTask.updateMany({
    where: resolved
      ? { sourceCommentId: commentId, deletedAt: null, status: { not: "done" } }
      : { sourceCommentId: commentId, deletedAt: null, status: "done" },
    data: { status: resolved ? "done" : "open" },
  });
  return result.count;
}

/** A task was just made from this comment: a resolved comment is open again, as its task is. */
export async function reopenCommentForNewTask(tx: Db, commentId: string) {
  await tx.albumSectionComment.updateMany({
    where: { id: commentId, deletedAt: null, resolvedAt: { not: null } },
    data: { resolvedAt: null, resolvedByUserId: null },
  });
}

/**
 * How a comment stands with its task, for the Studio's thread: "open" while an open task
 * tracks it, "done" once that task is done, null when it has no task (or only deleted ones).
 */
export type CommentTaskState = "open" | "done" | null;

export function commentTaskState(tasks: ReadonlyArray<{ status: string; deletedAt?: Date | null }>): CommentTaskState {
  const live = tasks.filter((task) => !task.deletedAt);
  if (!live.length) return null;
  return live.some((task) => isOpenTaskStatus(task.status)) ? "open" : "done";
}
