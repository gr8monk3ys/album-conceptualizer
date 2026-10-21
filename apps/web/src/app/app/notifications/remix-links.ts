import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/server/db";

/** The parts of a remix notification that find the remix it reports. */
export type RemixNotification = {
  id: string;
  type: string;
  /** The original: the owner's album that was remixed. */
  albumId: string | null;
  actorUserId: string | null;
  createdAt: Date;
  /** Newer notifications may name the remix itself (`{ remixAlbumId }`). */
  metadata: Prisma.JsonValue | null;
};

/** Where a remix row leads: the remix on Discover while it is published, else the owner's album. */
export type RemixLink = { href: string; onDiscover: boolean };

/** The remix's own id when the notification recorded it. */
export function recordedRemixId(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const id = (metadata as Record<string, unknown>).remixAlbumId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * The row's link: the remix's Discover page when it is published (the only page of another
 * artist's album the owner can open), otherwise the notification's own link to the album
 * that was remixed.
 */
export function remixRowLink(publishedRemixId: string | null, fallbackUrl: string | null): RemixLink | null {
  if (publishedRemixId) return { href: `/app/discover/${publishedRemixId}`, onDiscover: true };
  return fallbackUrl ? { href: fallbackUrl, onDiscover: false } : null;
}

/**
 * The published remix each remix notification reports, by notification id. Newer notifications
 * record the remix's id, and those are looked up together, in one query. Older ones find it by
 * its provenance: an album in a workspace the remixer owns or belongs to, whose
 * `remixed_from.album_id` is the original, created no later than the notification (the latest
 * such album, since every remix notifies once, right after it is made). A remix that isn't on
 * Discover has no page the owner can open, so only published ones are returned.
 */
export async function publishedRemixes(notifications: RemixNotification[]): Promise<Map<string, string>> {
  const remixes = notifications.filter((n) => n.type === "remix" && n.albumId);
  const found = new Map<string, string>();
  if (!remixes.length) return found;
  const prisma = getPrisma();
  const recorded = new Map(remixes.map((n) => [n.id, recordedRemixId(n.metadata)]));
  const recordedIds = [...new Set([...recorded.values()].filter((id): id is string => id !== null))];

  const [published] = await Promise.all([
    recordedIds.length
      ? prisma.album.findMany({ where: { id: { in: recordedIds }, isPublic: true }, select: { id: true } })
      : Promise.resolve([]),
    ...remixes.map(async (n) => {
      if (recorded.get(n.id) || !n.actorUserId) return;
      const remix = await prisma.album.findFirst({
        where: {
          createdAt: { lte: n.createdAt },
          data: { path: ["remixed_from", "album_id"], equals: n.albumId as string },
          workspace: {
            OR: [{ ownerId: n.actorUserId }, { members: { some: { userId: n.actorUserId } } }],
          },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, isPublic: true },
      });
      if (remix?.isPublic) found.set(n.id, remix.id);
    }),
  ]);

  const publishedIds = new Set(published.map((album) => album.id));
  for (const [notificationId, remixId] of recorded) {
    if (remixId && publishedIds.has(remixId)) found.set(notificationId, remixId);
  }
  return found;
}
