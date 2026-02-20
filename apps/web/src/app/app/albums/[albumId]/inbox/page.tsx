import Link from "next/link";
import { notFound } from "next/navigation";

import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { CompleteTaskButton, ResolveCommentButton } from "@/components/inbox-actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album Inbox",
  description: "Resolve album comments and tasks from a focused inbox.",
};

function excerpt(text: string, max = 220) {
  const t = text.trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default async function AlbumInboxPage({ params }: { params: Promise<{ albumId: string }> }) {
  const [{ albumId }, { userId }] = await Promise.all([params, requireUser()]);
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, title: true },
  });
  if (!album) notFound();

  const [comments, tasks] = await Promise.all([
    prisma.albumSectionComment.findMany({
      where: { albumId: album.id, deletedAt: null, resolvedAt: null },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        sectionId: true,
        songTrackNumber: true,
        sectionType: true,
        sectionOrder: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.albumTask.findMany({
      where: { albumId: album.id, deletedAt: null, status: { not: "done" } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        priority: true,
        dueAt: true,
        sectionId: true,
        songTrackNumber: true,
        sectionType: true,
        sectionOrder: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
  ]);

  const commentCount = comments.length;
  const taskCount = tasks.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Review inbox</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {commentCount} unresolved comments · {taskCount} open tasks
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/albums/${album.id}`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Back
          </Link>
          <Link
            href={`/app/albums/${album.id}/studio`}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Studio
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted2)]">Comments</div>
              <div className="text-sm font-semibold text-[var(--text)]">Unresolved</div>
            </div>
            <div className="text-xs text-[var(--muted)]">{commentCount}</div>
          </div>

          <div className="mt-3 space-y-2">
            {comments.length ? (
              comments.map((comment) => {
                const url = `/app/albums/${album.id}/studio?song=${comment.songTrackNumber}&sid=${encodeURIComponent(
                  comment.sectionId,
                )}`;
                const author = comment.author.name || comment.author.email || "User";
                return (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-[var(--muted2)]">
                          Track {comment.songTrackNumber} · {comment.sectionType} #
                          {comment.sectionOrder + 1}
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted2)]">
                          {author} · {comment.createdAt.toLocaleString()}
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                          {excerpt(comment.body)}
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        <Link
                          href={url}
                          className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[10px] font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                        >
                          Open
                        </Link>
                        <ResolveCommentButton albumId={album.id} commentId={comment.id} />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                No unresolved comments.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted2)]">Tasks</div>
              <div className="text-sm font-semibold text-[var(--text)]">Open</div>
            </div>
            <div className="text-xs text-[var(--muted)]">{taskCount}</div>
          </div>

          <div className="mt-3 space-y-2">
            {tasks.length ? (
              tasks.map((task) => {
                const url =
                  task.sectionId && task.songTrackNumber
                    ? `/app/albums/${album.id}/studio?song=${task.songTrackNumber}&sid=${encodeURIComponent(
                        task.sectionId,
                      )}`
                    : `/app/albums/${album.id}/inbox`;
                const creator = task.createdBy.name || task.createdBy.email || "User";
                const assignee = task.assignedTo?.name || task.assignedTo?.email || null;
                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">
                            {task.title}
                          </div>
                          <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted2)]">
                            {task.status}
                          </div>
                          <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted2)]">
                            P{task.priority}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted2)]">
                          {creator}
                          {assignee ? ` → ${assignee}` : ""} · {task.createdAt.toLocaleString()}
                        </div>
                        {task.body ? (
                          <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                            {excerpt(task.body)}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-none items-center gap-2">
                        <Link
                          href={url}
                          className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[10px] font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                        >
                          Open
                        </Link>
                        <CompleteTaskButton albumId={album.id} taskId={task.id} />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                No open tasks.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
