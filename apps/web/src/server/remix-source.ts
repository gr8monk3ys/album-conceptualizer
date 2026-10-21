import { getPrisma } from "@/server/db";

/** Where a remix came from, as Remix recorded it in the snapshot (server/album-fork.ts). */
export type RemixSource = {
  /** The original's database id, the one in its Discover address; null on older remixes. */
  albumId: string | null;
  title: string;
  artist: string | null;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The album a remix was forked from, read leniently from the snapshot's `remixed_from`
 * (`{ album_id, title, artist }`). Null for an album that isn't a remix, or whose record has
 * no title to show.
 */
export function remixSource(data: unknown): RemixSource | null {
  const source = (data as { remixed_from?: unknown } | null)?.remixed_from;
  if (!source || typeof source !== "object") return null;
  const record = source as { album_id?: unknown; title?: unknown; artist?: unknown };
  const title = text(record.title);
  if (!title) return null;
  return { albumId: text(record.album_id), title, artist: text(record.artist) };
}

/**
 * The original's Discover page, only while it is still published: a remix made from a share
 * link can point at a private album, and an unpublished one has no page to open.
 */
export async function remixSourceHref(source: RemixSource | null): Promise<string | null> {
  if (!source?.albumId) return null;
  const original = await getPrisma().album.findFirst({
    where: { id: source.albumId, isPublic: true },
    select: { id: true },
  });
  return original ? `/app/discover/${original.id}` : null;
}
