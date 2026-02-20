import Link from "next/link";

import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { MarkAllReadButton, ToggleNotificationReadButton } from "@/components/notifications-actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Notifications",
  description: "Review workspace notifications and clear unread updates.",
};

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
      actor: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Notifications</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Inbox
          </div>
          <div className="mt-2 max-w-[72ch] text-sm text-[var(--muted)]">
            Mentions, comments, and tasks across this workspace.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--muted)]">
            {unreadCount ? `${unreadCount} unread` : "all caught up"}
          </div>
          <MarkAllReadButton disabled={!unreadCount} />
        </div>
      </div>

      {notifications.length ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
          <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
            {notifications.map((n) => {
              const isUnread = !n.readAt;
              const meta = n.actor?.name || n.actor?.email || "System";
              return (
                <li
                  key={n.id}
                  className={[
                    "px-4 py-4",
                    isUnread
                      ? "bg-[linear-gradient(90deg,rgba(109,94,252,0.14),rgba(255,62,165,0.08))]"
                      : "bg-transparent",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-[var(--text)]">{n.title}</div>
                        <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted2)]">
                          {n.type}
                        </div>
                        {isUnread ? (
                          <div className="rounded-full bg-[rgba(50,213,131,0.14)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ok)]">
                            unread
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted2)]">
                        {meta} · {n.createdAt.toLocaleString()}
                      </div>
                      {n.body ? (
                        <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                          {n.body}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-none items-center gap-2">
                      {n.url ? (
                        <Link
                          href={n.url}
                          className="rounded-2xl bg-white px-3 py-2 text-[10px] font-semibold text-black hover:bg-white/90"
                        >
                          Open
                        </Link>
                      ) : null}
                      <ToggleNotificationReadButton id={n.id} unread={isUnread} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-6 text-sm text-[var(--muted)]">
          No notifications yet.
        </div>
      )}
    </div>
  );
}
