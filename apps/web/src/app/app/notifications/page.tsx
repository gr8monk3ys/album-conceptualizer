import Link from "next/link";

import { MarkAllReadButton, ToggleNotificationReadButton } from "@/components/notifications-actions";
import { RelativeTime } from "@/components/relative-time";
import { Chip, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Notifications",
  description: "Mentions, comments and tasks on your albums, and who liked or remixed them on Discover.",
};

const TYPE_LABEL: Record<string, string> = {
  mention: "Mention",
  comment: "Comment",
  task: "Task",
  like: "Like",
  remix: "Remix",
};

/** Likes and remixes name the artist in their title ("Theo Lind remixed Salt Year"). */
const NAMES_ACTOR_IN_TITLE = new Set(["like", "remix"]);

function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

export default async function NotificationsPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const notifications = await prisma.notification.findMany({
    where: { workspaceId: workspace.id, userId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      url: true,
      readAt: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Notifications"
        catalog={
          notifications.length ? (
            <span className="type-figure">{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>
          ) : undefined
        }
        description="Mentions, comments and tasks left on your albums' sections, and the artists who like or remix your albums on Discover."
        actions={notifications.length ? <MarkAllReadButton disabled={!unreadCount} /> : null}
      />

      {notifications.length ? (
        <ul aria-label="Notifications" className="border-t border-line">
          {notifications.map((n) => {
            const isUnread = !n.readAt;
            const who = n.actor?.name || n.actor?.email || "Album Conceptualizer";
            const title = (
              <>
                {isUnread ? <span className="sr-only">Unread: </span> : null}
                {n.title}
              </>
            );
            return (
              <li
                key={n.id}
                className="flex flex-col gap-3 border-b border-line py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
              >
                <div className="flex min-w-0 gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[1.1rem] h-2 w-2 shrink-0 rounded-full",
                      isUnread ? "bg-ink" : "bg-transparent",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {n.url ? (
                        <Link
                          href={n.url}
                          className={cn(
                            "inline-block max-w-full break-words py-2.5 text-base underline-offset-4 hover:underline",
                            isUnread ? "font-semibold text-ink" : "text-ink-2",
                          )}
                        >
                          {title}
                        </Link>
                      ) : (
                        <p
                          className={cn(
                            "min-w-0 break-words py-2.5 text-base",
                            isUnread ? "font-semibold text-ink" : "text-ink-2",
                          )}
                        >
                          {title}
                        </p>
                      )}
                      <Chip>{typeLabel(n.type)}</Chip>
                    </div>
                    <p className="text-xs text-ink-3">
                      {NAMES_ACTOR_IN_TITLE.has(n.type) ? null : <>{who} · </>}
                      <RelativeTime date={n.createdAt.toISOString()} />
                    </p>
                    {n.body ? (
                      <p className="mt-2 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">{n.body}</p>
                    ) : null}
                  </div>
                </div>
                <div className="self-end sm:self-start">
                  <ToggleNotificationReadButton id={n.id} unread={isUnread} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Nothing here yet">
          When someone comments on a section, mentions you with @name, or assigns you a task on an
          album, it shows up here with a link straight to that spot in the Studio. So does another
          artist liking or remixing an album you published to Discover.
        </EmptyState>
      )}
    </div>
  );
}
