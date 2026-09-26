import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompleteTaskButton, ResolveCommentButton } from "@/components/inbox-actions";
import { RelativeTime } from "@/components/relative-time";
import { ButtonLink, Chip, EmptyState, Section } from "@/components/ui";
import { AlbumJsonSchema } from "@/server/album-json";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { albumPageTitle, workspaceAlbumTitle } from "@/server/page-titles";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { taskDetail } from "@/lib/task-detail";
import { placeFor, sectionPlaceLine, sectionPlacePhrase, sectionPlaces, type SectionPlace } from "@/lib/section-place";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  const albumTitle = await workspaceAlbumTitle(albumId);
  if (!albumTitle) return { title: "Page not found" };
  return {
    title: albumPageTitle("Comments and tasks", albumTitle),
    description: "Resolve the album's section comments and open tasks in one place.",
  };
}

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

/**
 * "01 · Low Tide Leaving · Verse 1": where in the album a comment or task points, named as the
 * spine and the Studio name it (`@/lib/section-place`), or "Whole album".
 */
function PlaceLine({ place }: { place: SectionPlace | null }) {
  if (!place) return <>Whole album</>;
  return <span className="type-figure break-words">{sectionPlaceLine(place)}</span>;
}

// The album layout renders the title, catalog line, album tabs and spine above this page.
export default async function AlbumInboxPage({ params }: { params: Promise<{ albumId: string }> }) {
  const [{ albumId }, { userId }] = await Promise.all([params, requireUser()]);
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, title: true, data: true },
  });
  if (!album) notFound();
  // Tracks move and get renamed: each comment is named by where its section is now.
  const parsed = AlbumJsonSchema.safeParse(album.data);
  const songs = parsed.success ? parsed.data.songs : [];
  const places = sectionPlaces(songs);

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
                const place = placeFor(places, songs, comment);
                const phrase = place ? sectionPlacePhrase(place) : "the album";
                return (
                  <li
                    key={comment.id}
                    className="flex flex-col gap-3 py-4 @xl:flex-row @xl:items-start @xl:justify-between @xl:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink-2">
                        <PlaceLine place={place} />
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
                        aria-label={`Open in Studio: ${place ? sectionPlaceLine(place) : "the album"}`}
                      >
                        Open in Studio
                      </ButtonLink>
                      <ResolveCommentButton
                        albumId={album.id}
                        commentId={comment.id}
                        itemLabel={`comment on ${phrase}`}
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
                const detail = taskDetail(task.title, task.body);
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
                        <PlaceLine place={placeFor(places, songs, task)} />
                      </p>
                      {/* A task made from a comment has its first line as the title: only what
                          the comment adds after it is shown here, never the title again. */}
                      {detail ? (
                        <p className="mt-1 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
                          {excerpt(detail)}
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
