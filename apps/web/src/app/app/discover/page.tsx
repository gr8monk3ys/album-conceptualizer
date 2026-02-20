import { DiscoverAlbumCard } from "@/components/discover-album-card";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover",
  description: "Find public concept albums and fork ideas into your own projects.",
};

function normalizeQuery(value: string | string[] | undefined) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return "";
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = normalizeQuery(query.q);
  const shouldSearch = q.length >= 2;

  const { userId } = await requireUser();
  const prisma = getPrisma();

  const albums = await prisma.album.findMany({
    where: shouldSearch
      ? {
          isPublic: true,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { artist: { contains: q, mode: "insensitive" } },
            { conceptSummary: { contains: q, mode: "insensitive" } },
          ],
        }
      : { isPublic: true },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 40,
    select: {
      id: true,
      title: true,
      artist: true,
      primaryGenre: true,
      trackCount: true,
      coverUrl: true,
      publishedAt: true,
      _count: { select: { likes: true } },
      likes: { where: { userId }, select: { id: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-xs text-[var(--muted2)]">Discover</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Community projects
        </div>
        <div className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
          Browse published projects, like what hits, and fork a remix into your workspace.
        </div>
      </div>

      <form
        action="/app/discover"
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4"
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs text-[var(--muted2)]">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search published projects…"
            className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-[var(--muted2)]">
            {shouldSearch ? `${albums.length} results` : `${albums.length} trending`}
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Search
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-3">
        {albums.map((album) => (
          <DiscoverAlbumCard
            key={album.id}
            album={{
              id: album.id,
              title: album.title,
              artist: album.artist,
              primaryGenre: album.primaryGenre,
              trackCount: album.trackCount,
              coverUrl: album.coverUrl,
              publishedAt: album.publishedAt?.toISOString() ?? null,
              likes: album._count.likes,
              liked: Boolean(album.likes.length),
            }}
          />
        ))}
      </div>

      {albums.length ? null : (
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-6 text-sm text-[var(--muted)]">
          Nothing published yet. Publish a project from its details page to seed the feed.
        </div>
      )}
    </div>
  );
}
