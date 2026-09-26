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
 * The published remix each remix notification reports, by notification id. Remix
 * notifications don't yet record the new album's id, so a remix is found by its provenance: an
 * album in a workspace the remixer owns or belongs to, whose `remixed_from.album_id` is the
 * original, created no later than the notification (the latest such album, since every remix
 * notifies once, right after it is made). A remix that isn't on Discover has no page the owner
 * can open, so only published ones are returned.
 */
export async function publishedRemixes(notifications: RemixNotification[]): Promise<Map<string, string>> {
  const remixes = notifications.filter((n) => n.type === "remix" && n.albumId);
  const found = new Map<string, string>();
  if (!remixes.length) return found;
  const prisma = getPrisma();
  await Promise.all(
    remixes.map(async (n) => {
      const recorded = recordedRemixId(n.metadata);
      if (!recorded && !n.actorUserId) return;
      const where: Prisma.AlbumWhereInput = recorded
        ? { id: recorded }
        : {
            createdAt: { lte: n.createdAt },
            data: { path: ["remixed_from", "album_id"], equals: n.albumId as string },
            workspace: {
              OR: [{ ownerId: n.actorUserId as string }, { members: { some: { userId: n.actorUserId as string } } }],
            },
          };
      const remix = await prisma.album.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: { id: true, isPublic: true },
      });
      if (remix?.isPublic) found.set(n.id, remix.id);
    }),
  );
  return found;
}
