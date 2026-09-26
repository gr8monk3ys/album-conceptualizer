import type { Prisma } from "@prisma/client";

// In-app notification fan-out for album activity: comments and tasks, and likes and remixes
// from Discover. One call creates at most one notification per recipient; the actor is never
// notified of their own action, and only members of the workspace (the owner included) can
// receive one.

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

// ---------------------------------------------------------------------------------------------
// Discover activity: another artist liked or remixed a published album.
// ---------------------------------------------------------------------------------------------

export type AlbumActivity = "like" | "remix";

/** What the owner reads: "Theo Lind liked Salt Year", "Theo Lind remixed Salt Year". */
export function albumActivityTitle(kind: AlbumActivity, actorName: string | null | undefined, albumTitle: string) {
  const who = actorName?.trim() || "Another artist";
  const title = albumTitle.trim() || "your album";
  return `${who} ${kind === "like" ? "liked" : "remixed"} ${title}`;
}

/**
 * Tell an album's owner that someone liked or remixed it. Nobody hears about their own like
 * or remix. A like notifies once per liker and album, so unliking and liking again stays
 * quiet; every remix notifies (each one is a new album). The notification links to the album's
 * Overview in the owner's workspace. Returns true when one was created.
 */
export async function notifyAlbumOwner(
  db: Db,
  input: { albumId: string; actorUserId: string; kind: AlbumActivity },
): Promise<boolean> {
  const { albumId, actorUserId, kind } = input;
  const album = await db.album.findUnique({
    where: { id: albumId },
    select: { title: true, workspaceId: true, workspace: { select: { ownerId: true } } },
  });
  if (!album || album.workspace.ownerId === actorUserId) return false;

  if (kind === "like") {
    const already = await db.notification.findFirst({
      where: { userId: album.workspace.ownerId, albumId, actorUserId, type: "like" },
      select: { id: true },
    });
    if (already) return false;
  }

  const actor = await db.user.findUnique({ where: { id: actorUserId }, select: { name: true } });
  const created = await notifyWorkspaceMembers(db, {
    workspaceId: album.workspaceId,
    albumId,
    actorUserId,
    url: `/app/albums/${albumId}`,
    audiences: [{ to: "owner", type: kind, title: albumActivityTitle(kind, actor?.name, album.title) }],
  });
  return created > 0;
}

/**
 * `notifyAlbumOwner` for a route that has already done its work: a failed notification is
 * logged and never fails the like or the remix it reports.
 */
export async function notifyAlbumOwnerQuietly(
  db: Db,
  input: { albumId: string; actorUserId: string; kind: AlbumActivity },
): Promise<boolean> {
  try {
    return await notifyAlbumOwner(db, input);
  } catch (error) {
    console.error("album_activity_notify_failed", {
      albumId: input.albumId,
      kind: input.kind,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}
