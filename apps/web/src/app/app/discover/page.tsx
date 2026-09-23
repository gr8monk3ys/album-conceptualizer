import { DiscoverAlbumCard } from "@/components/discover-album-card";
import { Button, ButtonLink, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { writtenSummaryLine } from "@/lib/discover";
import { getSpineRows, getSpineThemes } from "@/server/album-songs";
import { getCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover",
  description: "Browse albums other artists have published, and remix one into your workspace.",
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
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const [albums, credits] = await Promise.all([
    prisma.album.findMany({
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
        conceptSummary: true,
        primaryGenre: true,
        workspaceId: true,
        data: true,
        publishedAt: true,
        _count: { select: { likes: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    }),
    getCredits({ workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) }),
  ]);

  const countLine = shouldSearch
    ? `${albums.length} ${albums.length === 1 ? "match" : "matches"} for “${q}”`
    : `${albums.length} published ${albums.length === 1 ? "album" : "albums"}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Community albums"
        description={`Albums artists have published to Discover, yours included. Open one to read its sequence and lyrics first. Like the ones that move you, or remix one: it becomes a new private album in your workspace for ${CREDIT_COSTS.albumFork} credits, and the original stays untouched.`}
      />

      <form action="/app/discover" method="get" role="search" aria-label="Published albums search" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <Field
            htmlFor="discover-q"
            label="Search published albums"
            className="min-w-0 flex-1 basis-64"
          >
            <input
              id="discover-q"
              name="q"
              type="search"
              defaultValue={q}
              autoComplete="off"
              spellCheck={false}
              placeholder="Title, artist or concept"
              className={inputClass}
            />
          </Field>
          <Button tone="secondary" type="submit">
            Search
          </Button>
        </div>
        <p className="max-w-[65ch] break-words text-sm text-ink-2" aria-live="polite">
          {countLine}
        </p>
      </form>

      {albums.length ? (
        <ul aria-label="Published albums" className="border-t border-line">
          {albums.map((album) => {
            const rows = getSpineRows(album.data);
            const written = writtenSummaryLine({
              tracks: rows.length,
              withLyrics: rows.filter((row) => row.lyricSections > 0).length,
            });
            return (
              <li key={album.id} className="border-b border-line">
                <DiscoverAlbumCard
                  creditsRemaining={credits.remaining}
                  album={{
                    id: album.id,
                    title: album.title,
                    artist: album.artist,
                    conceptSummary: album.conceptSummary?.trim() || null,
                    primaryGenre: album.primaryGenre,
                    written,
                    themes: getSpineThemes(album.data),
                    isOwn: album.workspaceId === workspace.id,
                    publishedAt: album.publishedAt?.toISOString() ?? null,
                    likes: album._count.likes,
                    liked: Boolean(album.likes.length),
                  }}
                />
              </li>
            );
          })}
        </ul>
      ) : shouldSearch ? (
        <EmptyState
          title={`Nothing published matches “${q}”`}
          action={
            <ButtonLink tone="secondary" href="/app/discover">
              Clear search
            </ButtonLink>
          }
        >
          Search looks at album titles, artist names and concept summaries. Try a single word from
          the concept, such as a mood or a place.
        </EmptyState>
      ) : (
        <EmptyState
          title="Nothing published yet"
          action={
            <ButtonLink tone="secondary" href="/app/library">
              Open your library
            </ButtonLink>
          }
        >
          When an artist publishes an album from its overview page, it shows up here for others to
          like and remix. Publish one of yours to be the first.
        </EmptyState>
      )}
    </div>
  );
}
