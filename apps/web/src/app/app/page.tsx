import Link from "next/link";

import { AlbumList, CatalogItems, ProgressLine, albumStatusLabel, toAlbumListItem } from "@/components/album-card";
import { RelativeTime } from "@/components/relative-time";
import { ButtonLink, EmptyState, PageHeader, Section } from "@/components/ui";
import { albumCatalogStatus } from "@/lib/album-skip";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { albumProgress, albumProgressById } from "@/server/album-progress";
import { nextAlbumStep } from "@/server/album-songs";
import { getAlbum, listAlbums } from "@/server/albums";
import { getDailyChallenge } from "@/server/challenges";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Home",
  description: "Pick up the album you were working on and see what it needs next.",
};

/** Other albums shown under Continue; the Library has the full catalog. */
const OTHERS_LIMIT = 4;

/**
 * Home is for picking the work back up: the album you edited last with its next step, a
 * few other albums in progress, and today's writing challenge. The Library is the catalog;
 * Home never lists the album it is already showing.
 */
export default async function AppHomePage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const albums = await listAlbums(workspace.id);
  const latest = albums[0] ? await getAlbum(workspace.id, albums[0].id) : null;
  // Where the latest album stands, told as every catalog row and the Coherence report tell it
  // (the One Score Story: "4 of 6 tracks written · Unfinished", then both scores).
  const latestProgress = latest ? albumProgress(latest.data) : null;
  // The same next step the album's release header shows, so the two never disagree.
  const step = latest ? nextAlbumStep(latest.id, latest.data) : null;
  const stepTitle = step?.trackTitle ?? null;

  // The other albums' rows carry the same progress figures as the Library's.
  const otherAlbums = albums.slice(1, 1 + OTHERS_LIMIT);
  const otherProgress = await albumProgressById(
    workspace.id,
    otherAlbums.map((album) => album.id),
  );
  const others = otherAlbums.map((album) => ({ ...toAlbumListItem(album), progress: otherProgress.get(album.id) }));
  const { challenge } = getDailyChallenge();

  const total = latestProgress?.tracks ?? 0;
  const story = latestProgress?.story ?? null;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        size="page"
        title="Home"
        description={
          latest
            ? "Pick up where you left off. The next step comes from what each track still needs."
            : "Start with a one-paragraph idea. You will shape it into a sequence of tracks, a narrative arc and a Story bible, then write it track by track."
        }
      />

      {latest && step ? (
        // A size container, so the album title below steps down in a narrow column (320px at
        // 200% text) instead of breaking inside a word.
        <section aria-labelledby="continue-title" className="@container border-t border-line pt-6">
          <h2 id="continue-title" className="text-lg font-semibold text-ink">
            Continue
          </h2>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="min-w-0 max-w-[68ch]">
              <Link
                href={`/app/albums/${latest.id}`}
                className="type-display inline-block min-h-11 max-w-full break-words py-2 text-[length:max(1rem,min(1.5rem,11cqi))] leading-tight text-ink hyphens-auto underline-offset-4 hover:underline md:text-[length:max(1rem,min(2.25rem,11cqi))]"
              >
                {latest.title}
              </Link>
              <p className="type-catalog mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-2">
                <CatalogItems
                  items={[
                    latest.artist || "No artist yet",
                    <span key="tracks" className="type-figure">
                      {total} {total === 1 ? "track" : "tracks"}
                    </span>,
                    // "On Discover" for a published album, as the Library row and the album's
                    // own catalog line say it.
                    albumCatalogStatus(latest, albumStatusLabel),
                    <span key="edited">
                      Edited <RelativeTime date={latest.updatedAt.toISOString()} />
                    </span>,
                  ]}
                />
              </p>
              {/* The One Score Story, in the words and order of the Library rows below. */}
              {total && story ? (
                <ProgressLine story={story} className="mt-4" />
              ) : null}
              <p className="mt-4 max-w-[65ch] break-words text-base text-ink">
                {step.statement}
                {stepTitle ? <span className="text-ink-2">{` · “${stepTitle}”`}</span> : null}
              </p>
            </div>
            {/* Continuing the record is Home's one primary action. */}
            <ButtonLink tone="primary" href={step.href}>
              {step.action}
            </ButtonLink>
          </div>
        </section>
      ) : (
        <EmptyState
          title="No albums yet"
          action={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ButtonLink tone="primary" href="/app/create">
                Start your first album
              </ButtonLink>
              <Link
                href="/app/help"
                className="inline-flex min-h-11 items-center text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
              >
                How an album comes together
              </Link>
            </div>
          }
        >
          The guided setup asks for a title, an artist and a concept, then drafts a sequence
          you can rewrite. Creating an album uses {CREDIT_COSTS.albumCreate} credits.
        </EmptyState>
      )}

      {others.length ? (
        <Section
          id="recent"
          title="Recent albums"
          description="Your other albums, most recently edited first."
          actions={
            albums.length > 1 + OTHERS_LIMIT ? (
              <ButtonLink tone="ghost" href="/app/library">
                All {albums.length} albums
              </ButtonLink>
            ) : null
          }
        >
          <AlbumList albums={others} hrefFor={(album) => `/app/albums/${album.id}`} />
        </Section>
      ) : null}

      <Section
        id="challenge"
        title="Today’s writing challenge"
        description={`${challenge.title}: ${challenge.description}`}
        actions={
          <ButtonLink tone="secondary" href="/app/challenges">
            Take the challenge · earn {challenge.credits} credits
          </ButtonLink>
        }
      >
        <p className="text-sm text-ink-3">A short prompt to write against. One completion a day.</p>
      </Section>
    </div>
  );
}
