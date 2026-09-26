import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DiscoverAlbumCard } from "@/components/discover-album-card";
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
  widenViewHref,
  writtenSummaryLine,
  type DiscoverView,
} from "@/lib/discover";
import { cn } from "@/lib/utils";
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

/**
 * Albums read when the order or filter depends on the snapshot (how much is written), which
 * the database can't sort by: the newest this many are ranked here.
 */
const RANKING_WINDOW = 160;

/** One option of the sort or show row: a link to that view, marked when it is the current one. */
function ViewOption({ href, current, children }: { href: string; current: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={current ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded px-2 text-sm transition-colors",
        current
          ? "font-semibold text-ink underline decoration-ink-2 decoration-1 underline-offset-8"
          : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

function ViewOptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode[];
}) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-wrap items-center gap-x-1">
      <span aria-hidden="true" className="mr-1 text-sm text-ink-3">
        {label}
      </span>
      {children.map((child, index) => (
        <span key={index} className="flex items-center gap-x-1">
          {index > 0 ? (
            <span aria-hidden="true" className="text-ink-3">
              ·
            </span>
          ) : null}
          {child}
        </span>
      ))}
    </div>
  );
}

/**
 * Hidden inputs that carry the rest of the view through a form that changes one part of it, so
 * a new or cleared search keeps the sort, "Finished only" and the genre. The page is never
 * carried: a changed search or filter starts its list from the top.
 */
function ViewFields({ view, omit }: { view: DiscoverView; omit: Array<keyof DiscoverView> }) {
  return (
    <>
      {!omit.includes("q") && view.q ? <input type="hidden" name="q" value={view.q} /> : null}
      {!omit.includes("sort") && view.sort !== "newest" ? (
        <input type="hidden" name="sort" value={view.sort} />
      ) : null}
      {!omit.includes("show") && view.show !== "all" ? (
        <input type="hidden" name="show" value={view.show} />
      ) : null}
      {!omit.includes("genre") && view.genre ? <input type="hidden" name="genre" value={view.genre} /> : null}
    </>
  );
}

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

  const [found, databaseTotal, genreRows, credits] = await Promise.all([
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
    getCredits({ workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) }),
  ]);

  const rankable = found.map((album) => {
    const rows = getSpineRows(album.data);
    const withLyrics = rows.filter((row) => row.lyricSections > 0).length;
    return {
      album,
      tracks: rows.length,
      withLyrics,
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
      <PageHeader
        title="Discover"
        description={`Albums artists have published, yours included. Open one to read its sequence and lyrics. A remix makes a new private album in your workspace for ${CREDIT_COSTS.albumFork} credits; the original and its artist are not affected.`}
      />

      <div className="flex flex-col gap-3">
        <Form action="/app/discover" role="search" aria-label="Published albums search">
          <ViewFields view={view} omit={["q"]} />
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
        </Form>

        {/* The view: a quiet row of links (and a genre select), each view its own URL. */}
        <div className="@container border-b border-line pb-2">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <ViewOptionGroup label="Sort">
              {DISCOVER_SORTS.map((option) => (
                <ViewOption
                  key={option.value}
                  href={discoverHref({ ...view, sort: option.value, page: 1 })}
                  current={view.sort === option.value}
                >
                  {option.label}
                </ViewOption>
              ))}
            </ViewOptionGroup>
            <ViewOptionGroup label="Show">
              {DISCOVER_SHOWS.map((option) => (
                <ViewOption
                  key={option.value}
                  href={discoverHref({ ...view, show: option.value, page: 1 })}
                  current={view.show === option.value}
                >
                  {option.label}
                </ViewOption>
              ))}
            </ViewOptionGroup>
            {showGenre ? (
              // Label above, select as wide as the form: a select otherwise sizes itself to its
              // longest genre, which pushed a narrow page sideways.
              <Form
                action="/app/discover"
                aria-label="Filter by genre"
                className="flex w-full min-w-0 flex-col gap-1 @xl:w-64"
              >
                <ViewFields view={view} omit={["genre"]} />
                <label htmlFor="discover-genre" className="text-sm text-ink-3">
                  Genre
                </label>
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
                <noscript>
                  <Button tone="ghost" type="submit" className="self-start">
                    Apply
                  </Button>
                </noscript>
              </Form>
            ) : null}
          </div>
        </div>

        <p className="max-w-[65ch] break-words text-sm text-ink-2" aria-live="polite">
          {countLine}
        </p>
      </div>

      {albums.length ? (
        <>
          <ul aria-label="Published albums" className="border-t border-line">
            {albums.map(({ album, tracks, withLyrics }) => {
              const written = writtenSummaryLine({ tracks, withLyrics });
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
