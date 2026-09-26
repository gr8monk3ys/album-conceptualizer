import Form from "next/form";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DiscoverAlbumCard } from "@/components/discover-album-card";
import { DiscoverFilters } from "@/components/discover-filters";
import { SubmitOnChangeSelect } from "@/components/submit-on-change-select";
import { Button, ButtonLink, EmptyState, Field, PageHeader, inputClass, selectClass } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import {
  DISCOVER_PAGE_SIZE,
  DISCOVER_SHOWS,
  DISCOVER_SORTS,
  arrangeDiscoverAlbums,
  clearSearchHref,
  discoverCountLine,
  discoverHref,
  discoverPage,
  genreOptions,
  isNarrowedView,
  parseDiscoverView,
  themeTrackMarks,
  widenViewHref,
  type DiscoverView,
} from "@/lib/discover";
import { discoverFilterSummary, hasActiveDiscoverFilters } from "@/lib/discover-filters";
import { cn } from "@/lib/utils";
import { getSpineRows, getSpineThemes } from "@/server/album-songs";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover",
  description: "Browse albums other artists have published, and remix one into your workspace.",
};

/**
 * Albums read when the order or filter depends on the snapshot (how much is written), which
 * the database can't sort by: the newest this many are ranked here.
 */
const RANKING_WINDOW = 160;

/** "only finished albums", "only folk", "only finished albums in folk". */
function narrowedViewPhrase(view: DiscoverView) {
  const finished = view.show === "finished";
  if (finished && view.genre) return `only finished albums in ${view.genre}`;
  return finished ? "only finished albums" : `only ${view.genre}`;
}

/** Previous and next page, as links that keep the rest of the view. */
function Pagination({ view, page, pageCount }: { view: DiscoverView; page: number; pageCount: number }) {
  return (
    <nav aria-label="Pages of published albums" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {page > 1 ? (
        <ButtonLink tone="secondary" rel="prev" href={discoverHref({ ...view, page: page - 1 })}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous page
        </ButtonLink>
      ) : null}
      <p className="type-figure text-sm text-ink-2">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <ButtonLink tone="secondary" rel="next" href={discoverHref({ ...view, page: page + 1 })}>
          Next page
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </ButtonLink>
      ) : null}
    </nav>
  );
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = parseDiscoverView(await searchParams);
  const q = view.q;
  const shouldSearch = q.length >= 2;

  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  // "Most written" and "Finished only" read the snapshot, so they rank a wider window here.
  const ranksInApp = view.sort === "written" || view.show === "finished";

  const where: Prisma.AlbumWhereInput = {
    isPublic: true,
    ...(shouldSearch
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { artist: { contains: q, mode: "insensitive" } },
            { conceptSummary: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(view.genre ? { primaryGenre: { equals: view.genre, mode: "insensitive" } } : {}),
  };

  const [found, databaseTotal, genreRows] = await Promise.all([
    prisma.album.findMany({
      where,
      orderBy:
        view.sort === "liked"
          ? [{ likes: { _count: "desc" } }, { publishedAt: "desc" }, { updatedAt: "desc" }]
          : [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      // Database order: read just this page. Snapshot order: rank the window, then slice.
      skip: ranksInApp ? 0 : (view.page - 1) * DISCOVER_PAGE_SIZE,
      take: ranksInApp ? RANKING_WINDOW : DISCOVER_PAGE_SIZE,
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
    ranksInApp ? Promise.resolve(0) : prisma.album.count({ where }),
    prisma.album.findMany({
      where: { isPublic: true, primaryGenre: { not: null } },
      distinct: ["primaryGenre"],
      select: { primaryGenre: true },
      take: 60,
    }),
  ]);

  const rankable = found.map((album) => {
    const rows = getSpineRows(album.data);
    const trackLyrics = rows.map((row) => row.lyricSections > 0);
    const themes = getSpineThemes(album.data);
    return {
      album,
      trackLyrics,
      themes,
      themeTracks: themeTrackMarks(themes, rows),
      tracks: trackLyrics.length,
      withLyrics: trackLyrics.filter(Boolean).length,
      likes: album._count.likes,
      publishedAt: album.publishedAt?.toISOString() ?? null,
      primaryGenre: album.primaryGenre,
    };
  });
  // Ranked here: the whole window is arranged, then one page of it is shown. Ordered by the
  // database: `found` is already this page, in order.
  const arranged = ranksInApp ? arrangeDiscoverAlbums(rankable, view) : rankable;
  const total = ranksInApp ? arranged.length : databaseTotal;
  const page = discoverPage(total, view.page);
  // A page past the end (an old link, a list that shrank) goes to the last page there is.
  if (page.page !== view.page) redirect(discoverHref({ ...view, page: page.page }));
  const albums = ranksInApp ? arranged.slice(page.start, page.end) : arranged;

  // A genre filter is offered once there is more than one genre to choose between.
  const genres = genreOptions(genreRows.map((row) => row.primaryGenre));
  const showGenre = genres.length > 1 || Boolean(view.genre);
  const countLine = discoverCountLine(total, view, page);

  return (
    <div className="flex flex-col gap-8">
      {/* The display cut: Discover is a public page of artists' work, not one of the app's own
          screens (DESIGN.md, Typography: display-md for Discover; page-title for Home, New album…). */}
      <PageHeader
        title="Discover"
        description={`Albums artists have published, yours included. Open one to read its sequence and lyrics. A remix makes a new private album in your workspace for ${CREDIT_COSTS.albumFork} credits; the original and its artist are not affected.`}
      />

      <div className="flex flex-col gap-3">
        {/* One GET form for the whole view, so every view is its own URL: the search, one Sort
            and one Show select (and the genre once there is more than one). A select applies
            as soon as it changes; without JavaScript, Search applies everything. A size
            container: below 40rem (a phone, enlarged text) the selects fold into a "Filters"
            disclosure that names their settings, so the list starts in the first screen;
            stacked in a narrow column, side by side once the row has room (rem, so enlarged
            text stacks). */}
        <Form action="/app/discover" role="search" aria-label="Published albums search" className="@container/filters">
          <div className="flex flex-wrap items-end gap-3">
            <Field htmlFor="discover-q" label="Search published albums" className="min-w-0 flex-[1_1_16rem]">
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
          <DiscoverFilters summary={discoverFilterSummary(view)} defaultOpen={hasActiveDiscoverFilters(view)}>
            <div
              className={cn(
                "grid grid-cols-1 gap-3 @md:grid-cols-2",
                showGenre ? "@3xl:grid-cols-3" : "@3xl:max-w-[36rem]",
              )}
            >
              <Field htmlFor="discover-sort" label="Sort" className="min-w-0">
                <SubmitOnChangeSelect
                  id="discover-sort"
                  name="sort"
                  defaultValue={view.sort}
                  className={cn(selectClass, "w-full min-w-0")}
                >
                  {DISCOVER_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SubmitOnChangeSelect>
              </Field>
              <Field htmlFor="discover-show" label="Show" className="min-w-0">
                <SubmitOnChangeSelect
                  id="discover-show"
                  name="show"
                  defaultValue={view.show}
                  className={cn(selectClass, "w-full min-w-0")}
                >
                  {DISCOVER_SHOWS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SubmitOnChangeSelect>
              </Field>
              {showGenre ? (
                // As wide as its cell: a select otherwise sizes itself to its longest genre,
                // which pushed a narrow page sideways.
                <Field htmlFor="discover-genre" label="Genre" className="min-w-0 @md:col-span-2 @3xl:col-span-1">
                  <SubmitOnChangeSelect
                    id="discover-genre"
                    name="genre"
                    defaultValue={view.genre ?? ""}
                    className={cn(selectClass, "w-full min-w-0")}
                  >
                    <option value="">All genres</option>
                    {genres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                    {view.genre && !genres.some((genre) => genre.toLowerCase() === view.genre?.toLowerCase()) ? (
                      <option value={view.genre}>{view.genre}</option>
                    ) : null}
                  </SubmitOnChangeSelect>
                </Field>
              ) : null}
            </div>
          </DiscoverFilters>
        </Form>

        <p className="max-w-[65ch] break-words text-sm text-ink-2" aria-live="polite">
          {countLine}
        </p>
      </div>

      {albums.length ? (
        <>
          <ul aria-label="Published albums" className="border-t border-line">
            {albums.map(({ album, trackLyrics, themes, themeTracks }) => (
              <li key={album.id} className="border-b border-line">
                <DiscoverAlbumCard
                  album={{
                    id: album.id,
                    title: album.title,
                    artist: album.artist,
                    conceptSummary: album.conceptSummary?.trim() || null,
                    primaryGenre: album.primaryGenre,
                    trackLyrics,
                    themes,
                    themeTracks,
                    isOwn: album.workspaceId === workspace.id,
                    publishedAt: album.publishedAt?.toISOString() ?? null,
                    likes: album._count.likes,
                    liked: Boolean(album.likes.length),
                  }}
                />
              </li>
            ))}
          </ul>
          {page.pageCount > 1 ? <Pagination view={view} page={page.page} pageCount={page.pageCount} /> : null}
        </>
      ) : shouldSearch ? (
        <EmptyState
          title={`Nothing published matches “${q}”${isNarrowedView(view) ? " in this view" : ""}`}
          action={
            <div className="flex flex-wrap gap-3">
              {/* Clearing the search keeps the rest of the view ("Finished only", the genre). */}
              <ButtonLink tone="secondary" href={clearSearchHref(view)}>
                Clear search
              </ButtonLink>
              {isNarrowedView(view) ? (
                <ButtonLink tone="ghost" href={widenViewHref(view)}>
                  Search all albums
                </ButtonLink>
              ) : null}
            </div>
          }
        >
          Search looks at album titles, artist names and concept summaries. Try a single word from
          the concept, such as a mood or a place.
          {isNarrowedView(view)
            ? ` This view shows ${narrowedViewPhrase(view)}; search all albums to look past it.`
            : null}
        </EmptyState>
      ) : isNarrowedView(view) ? (
        <EmptyState
          title={view.show === "finished" ? "No finished albums in this view" : `Nothing published in ${view.genre}`}
          action={
            <ButtonLink tone="secondary" href={widenViewHref(view)}>
              Show all albums
            </ButtonLink>
          }
        >
          {view.show === "finished"
            ? "A finished album has written lyrics on every track. Show all albums to read the ones still being written, too."
            : "No published album lists this as its genre yet. Show all albums to browse every genre."}
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
