import type { Prisma } from "@prisma/client";

// In-app notification fan-out for album activity (comments, tasks). One call creates at most
// one notification per recipient; the actor is never notified of their own action, and only
// members of the workspace (the owner included) can receive one.

type Db = Prisma.TransactionClient;

const EXCERPT_LENGTH = 240;
const MAX_MENTIONS = 16;
const MENTION_PATTERN = /@([a-zA-Z0-9][a-zA-Z0-9._-]{1,31})/g;

export type NotificationAudience = {
  /** The users to notify, or "owner" for the workspace owner. Empty ids are skipped. */
  to: "owner" | ReadonlyArray<string | null | undefined>;
  type: string;
  title: string;
};

export type AlbumNotification = {
  workspaceId: string;
  albumId: string;
  actorUserId: string;
  url: string;
  /** Free text the notification quotes; trimmed and cut to an excerpt. */
  body?: string | null;
  commentId?: string;
  taskId?: string;
  /**
   * Who hears about it, in priority order: a user in several audiences gets only the
   * notification of the first one they appear in.
   */
  audiences: NotificationAudience[];
};

/** Create the notifications for one piece of album activity. Returns how many were created. */
export async function notifyWorkspaceMembers(db: Db, notification: AlbumNotification) {
  const { workspaceId, albumId, actorUserId, url, commentId, taskId, audiences } = notification;

  const named = new Set<string>();
  for (const audience of audiences) {
    if (audience.to === "owner") continue;
    for (const userId of audience.to) if (userId && userId !== actorUserId) named.add(userId);
  }
  if (named.size === 0 && !audiences.some((audience) => audience.to === "owner")) return 0;

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      members: { where: { userId: { in: [...named] } }, select: { userId: true } },
    },
  });
  if (!workspace) return 0;

  const members = new Set(workspace.members.map((member) => member.userId));
  members.add(workspace.ownerId);

  const body = notification.body?.trim().slice(0, EXCERPT_LENGTH) || undefined;
  const notified = new Set<string>([actorUserId]);
  const data: Prisma.NotificationCreateManyInput[] = [];
  for (const audience of audiences) {
    const recipients = audience.to === "owner" ? [workspace.ownerId] : audience.to;
    for (const userId of recipients) {
      if (!userId || notified.has(userId) || !members.has(userId)) continue;
      notified.add(userId);
      data.push({
        workspaceId,
        userId,
        actorUserId,
        type: audience.type,
        title: audience.title,
        body,
        url,
        albumId,
        commentId,
        taskId,
      });
    }
  }

  if (data.length) await db.notification.createMany({ data });
  return data.length;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Workspace members `@mentioned` in a piece of text. A member answers to their email, the
 * part of it before the @, their name squashed to letters and digits, and their first name.
 */
export async function findMentionedMembers(db: Db, workspaceId: string, text: string) {
  const tokens = Array.from(text.matchAll(MENTION_PATTERN))
    .map((match) => (match[1] ?? "").toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_MENTIONS);
  if (tokens.length === 0) return [];

  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    select: { user: { select: { id: true, name: true, email: true } } },
    take: 100,
  });

  const mentioned: string[] = [];
  for (const { user } of members) {
    const handles = new Set<string>();
    if (user.email) {
      const email = user.email.toLowerCase();
      handles.add(email);
      handles.add(email.split("@")[0] ?? "");
    }
    if (user.name) {
      const full = slug(user.name);
      if (full) handles.add(full);
      const first = slug(user.name.split(/\s+/g)[0] ?? "");
      if (first) handles.add(first);
    }
    if (tokens.some((token) => handles.has(token))) mentioned.push(user.id);
  }
  return mentioned;
}

/** Where a notification about an album item links: its section in the studio, or the inbox. */
export function albumItemUrl(
  albumId: string,
  target: { songTrackNumber: number | null; sectionId: string | null },
) {
  const base = `/app/albums/${albumId}`;
  return target.sectionId && target.songTrackNumber
    ? `${base}/studio?song=${target.songTrackNumber}&sid=${encodeURIComponent(target.sectionId)}`
    : `${base}/inbox`;
}
