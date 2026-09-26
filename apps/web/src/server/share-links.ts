import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/server/db";

/** The album behind a share link that is neither revoked nor expired, or null. */
export async function findSharedAlbum<Select extends Prisma.AlbumSelect>(
  token: string,
  select: Select,
): Promise<Prisma.AlbumGetPayload<{ select: Select }> | null> {
  const share = await getPrisma().albumShareLink.findUnique({
    where: { token },
    select: { revokedAt: true, expiresAt: true, album: { select } },
  });
  if (!share?.album || share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;
  return share.album as Prisma.AlbumGetPayload<{ select: Select }>;
}
