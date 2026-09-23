import Link from "next/link";

import { AlbumList, CatalogItems, albumStatusLabel, toAlbumListItem } from "@/components/album-card";
import { RelativeTime } from "@/components/relative-time";
import { ButtonLink, EmptyState, PageHeader, Section } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { getSpineRows, type SpineRow } from "@/server/album-songs";
import { getAlbum, listAlbums } from "@/server/albums";
import { getDailyChallenge } from "@/server/challenges";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your albums",
  description: "Pick up the album you were working on and see what it needs next.",
};

const RECENT_LIMIT = 8;

type NextStep = { statement: string; action: string; href: string; trackNumber?: number };

/** The single most useful thing to do next on an album, read from its tracklist. */
function nextStepFor(albumId: string, rows: SpineRow[]): NextStep {
  const studio = `/app/albums/${albumId}/studio`;
  if (!rows.length) {
    return {
      statement: "No tracks yet. Sketch the first one to give the record a shape.",
      action: "Add the first track",
      href: studio,
    };
  }
  const needsLyrics = rows.find((row) => row.sections === 0 || row.lyricSections < row.sections);
  if (needsLyrics) {
    return {
      statement: `Track ${needsLyrics.trackNumber} needs lyrics`,
      action: `Write track ${needsLyrics.trackNumber}`,
      href: `${studio}?song=${needsLyrics.trackNumber}`,
      trackNumber: needsLyrics.trackNumber,
    };
  }
  const needsThemes = rows.find((row) => row.themes === 0);
  if (needsThemes) {
    return {
      statement: `Track ${needsThemes.trackNumber} needs its themes tagged`,
      action: `Tag track ${needsThemes.trackNumber}`,
      href: `${studio}?song=${needsThemes.trackNumber}`,
      trackNumber: needsThemes.trackNumber,
    };
  }
  const needsNarrative = rows.find((row) => !row.hasNarrative);
  if (needsNarrative) {
    return {
      statement: `Track ${needsNarrative.trackNumber} needs its narrative role`,
      action: `Place track ${needsNarrative.trackNumber}`,
      href: `${studio}?song=${needsNarrative.trackNumber}`,
      trackNumber: needsNarrative.trackNumber,
    };
  }
  return {
    statement: "Every track has lyrics, themes and a narrative role. Check how they hold together.",
    action: "Read the coherence report",
    href: `/app/albums/${albumId}/coherence`,
  };
}

export default async function AppHomePage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const albums = await listAlbums(workspace.id);
  const latest = albums[0] ? await getAlbum(workspace.id, albums[0].id) : null;
  const latestRows = latest ? getSpineRows(latest.data) : [];
  const step = latest ? nextStepFor(latest.id, latestRows) : null;
  const stepTrack = step?.trackNumber
    ? latestRows.find((row) => row.trackNumber === step.trackNumber)
    : null;
  // Scaffolded titles ("Track 3") add nothing next to "Track 3 needs lyrics".
  const stepTitle = stepTrack && !/^track\s*\d+$/i.test(stepTrack.title.trim()) ? stepTrack.title : null;

  const recent = albums.slice(0, RECENT_LIMIT).map(toAlbumListItem);
  const { challenge } = getDailyChallenge();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Your albums"
        description={
          latest
            ? "Pick up where you left off. The next step comes from what each track still needs."
            : "Start with a one-paragraph idea. You will shape it into a tracklist, a narrative arc and an Album Bible, then write it track by track."
        }
      />

      {latest && step ? (
        <section aria-labelledby="continue-title" className="border-t border-line pt-6">
          <h2 id="continue-title" className="text-lg font-semibold text-ink">
            Continue
          </h2>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="min-w-0 max-w-[68ch]">
              <Link
                href={`/app/albums/${latest.id}`}
                className="type-display inline-flex min-h-11 items-center text-2xl text-ink underline-offset-4 hover:underline md:text-4xl"
              >
                {latest.title}
              </Link>
              <p className="type-catalog mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-2">
                <CatalogItems
                  items={[
                    latest.artist || "No artist yet",
                    <span key="tracks" className="type-figure">
                      {latestRows.length} {latestRows.length === 1 ? "track" : "tracks"}
                    </span>,
                    albumStatusLabel(latest.status),
                    <span key="edited">
                      Edited <RelativeTime date={latest.updatedAt.toISOString()} />
                    </span>,
                  ]}
                />
              </p>
              <p className="mt-4 text-base text-ink">
                {step.statement}
                {stepTitle ? <span className="text-ink-2">{` · “${stepTitle}”`}</span> : null}
              </p>
            </div>
            <ButtonLink tone="primary" href={step.href}>
              {step.action}
            </ButtonLink>
          </div>
        </section>
      ) : null}

      <Section
        id="recent"
        title="Recent projects"
        description={latest ? "Your albums, most recently edited first." : undefined}
        actions={
          albums.length > RECENT_LIMIT ? (
            <ButtonLink tone="ghost" href="/app/library">
              All albums
            </ButtonLink>
          ) : null
        }
      >
        {recent.length ? (
          <AlbumList albums={recent} hrefFor={(album) => `/app/albums/${album.id}`} />
        ) : (
          <EmptyState
            title="No albums yet"
            action={
              <ButtonLink tone="primary" href="/app/create">
                Start your first album
              </ButtonLink>
            }
          >
            The guided setup asks for a title, an artist and a concept, then drafts a tracklist
            you can rewrite. Creating an album uses {CREDIT_COSTS.albumCreate} credits.
          </EmptyState>
        )}
      </Section>

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
