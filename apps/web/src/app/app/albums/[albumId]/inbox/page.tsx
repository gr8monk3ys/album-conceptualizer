import { notFound } from "next/navigation";

import { CompleteTaskButton, ResolveCommentButton } from "@/components/inbox-actions";
import { RelativeTime } from "@/components/relative-time";
import { ButtonLink, Chip, EmptyState, Section } from "@/components/ui";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Comments and tasks",
  description: "Resolve the album's section comments and open tasks in one place.",
};

const TASK_STATUS: Record<string, { label: string; tone: "neutral" | "ok" }> = {
  open: { label: "Open", tone: "neutral" },
  in_progress: { label: "In progress", tone: "neutral" },
  done: { label: "Done", tone: "ok" },
};

function excerpt(text: string, max = 220) {
  const t = text.trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatSectionType(value: string | null) {
  if (!value) return null;
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Track 3 · Section 2 · Chorus": where in the album a comment or task points. */
function SectionPlace({
  track,
  order,
  type,
}: {
  track: number | null;
  order: number | null;
  type: string | null;
}) {
  const sectionType = formatSectionType(type);
  if (!track) return <>Whole album</>;
  return (
    <>
      Track <span className="type-figure">{track}</span>
      {order !== null ? (
        <>
          {" · Section "}
          <span className="type-figure">{order + 1}</span>
        </>
      ) : null}
      {sectionType ? ` · ${sectionType}` : null}
    </>
  );
}

// The album layout renders the title, catalog line, album tabs and spine above this page.
export default async function AlbumInboxPage({ params }: { params: Promise<{ albumId: string }> }) {
  const [{ albumId }, { userId }] = await Promise.all([params, requireUser()]);
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, title: true },
  });
  if (!album) notFound();

  const [comments, tasks, otherMembers] = await Promise.all([
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
    prisma.workspaceMember.count({ where: { workspaceId: workspace.id, userId: { not: userId } } }),
  ]);
  // The owner may predate member rows; count them as a collaborator if they aren't the viewer.
  const workingAlone = otherMembers === 0 && workspace.ownerId === userId;

  const studioUrl = `/app/albums/${album.id}/studio`;
  const sectionUrl = (track: number, sectionId: string) =>
    `${studioUrl}?song=${track}&sid=${encodeURIComponent(sectionId)}`;

  return (
    <Section
      id="inbox"
      title="Comments and tasks"
      description={
        workingAlone
          ? "You're the only one in this workspace, so comments are notes to yourself; @mentions notify collaborators once they join."
          : "Everything left on a section in the Studio waits here until it's resolved or done."
      }
    >
      <div className="flex flex-col gap-10">
        <Section
          id="inbox-comments"
          headingLevel={3}
          title="Unresolved comments"
          description={
            comments.length
              ? `${comments.length} ${comments.length === 1 ? "comment is" : "comments are"} waiting on a section, oldest first.`
              : undefined
          }
        >
          {comments.length ? (
            <ul className="@container divide-y divide-line border-y border-line">
              {comments.map((comment) => {
                const author = comment.author.name || comment.author.email || "A collaborator";
                const place = `Track ${comment.songTrackNumber}, section ${comment.sectionOrder + 1}`;
                return (
                  <li
                    key={comment.id}
                    className="flex flex-col gap-3 py-4 @xl:flex-row @xl:items-start @xl:justify-between @xl:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink-2">
                        <SectionPlace
                          track={comment.songTrackNumber}
                          order={comment.sectionOrder}
                          type={comment.sectionType}
                        />
                      </p>
                      <p className="mt-1 max-w-[65ch] break-words text-sm leading-relaxed text-ink">
                        {excerpt(comment.body)}
                      </p>
                      <p className="mt-1 text-xs text-ink-3">
                        {author} · <RelativeTime date={comment.createdAt.toISOString()} />
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-start gap-2">
                      <ButtonLink
                        href={sectionUrl(comment.songTrackNumber, comment.sectionId)}
                        tone="ghost"
                        className="px-3"
                        aria-label={`Open in Studio: ${place}`}
                      >
                        Open in Studio
                      </ButtonLink>
                      <ResolveCommentButton
                        albumId={album.id}
                        commentId={comment.id}
                        itemLabel={`comment on ${place}`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="No unresolved comments"
              action={
                <ButtonLink href={studioUrl} tone="secondary">
                  Open Studio
                </ButtonLink>
              }
            >
              Comments left on a section in the Studio wait here until someone resolves them.
            </EmptyState>
          )}
        </Section>

        <Section
          id="inbox-tasks"
          headingLevel={3}
          title="Open tasks"
          description={
            tasks.length
              ? `${tasks.length} ${tasks.length === 1 ? "task is" : "tasks are"} still open.`
              : undefined
          }
        >
          {tasks.length ? (
            <ul className="@container divide-y divide-line border-y border-line">
              {tasks.map((task) => {
                const url =
                  task.sectionId && task.songTrackNumber
                    ? sectionUrl(task.songTrackNumber, task.sectionId)
                    : null;
                const creator = task.createdBy.name || task.createdBy.email || "A collaborator";
                const assignee = task.assignedTo?.name || task.assignedTo?.email || null;
                const status = TASK_STATUS[task.status] ?? {
                  label: formatSectionType(task.status) ?? task.status,
                  tone: "neutral" as const,
                };
                return (
                  <li
                    key={task.id}
                    className="flex flex-col gap-3 py-4 @xl:flex-row @xl:items-start @xl:justify-between @xl:gap-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words text-sm font-semibold text-ink">
                          {task.title}
                        </p>
                        <Chip tone={status.tone}>{status.label}</Chip>
                        {task.priority !== 2 ? (
                          <Chip>
                            Priority <span className="type-figure">{task.priority}</span>
                          </Chip>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-ink-2">
                        <SectionPlace
                          track={task.songTrackNumber}
                          order={task.sectionOrder}
                          type={task.sectionType}
                        />
                      </p>
                      {task.body ? (
                        <p className="mt-1 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
                          {excerpt(task.body)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-ink-3">
                        {creator}
                        {assignee ? ` → ${assignee}` : ""} ·{" "}
                        <RelativeTime date={task.createdAt.toISOString()} />
                        {task.dueAt ? (
                          <>
                            {" · Due "}
                            <RelativeTime date={task.dueAt.toISOString()} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-start gap-2">
                      {url ? (
                        <ButtonLink
                          href={url}
                          tone="ghost"
                          className="px-3"
                          aria-label={`Open in Studio: ${task.title}`}
                        >
                          Open in Studio
                        </ButtonLink>
                      ) : null}
                      <CompleteTaskButton albumId={album.id} taskId={task.id} itemLabel={task.title} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No open tasks">
              Turn a section comment into a task in the Studio and it stays here until it&apos;s
              done.
            </EmptyState>
          )}
        </Section>
      </div>
    </Section>
  );
}
