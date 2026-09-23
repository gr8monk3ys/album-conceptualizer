import Link from "next/link";

import { AlbumList, CatalogItems, albumStatusLabel, toAlbumListItem } from "@/components/album-card";
import { RelativeTime } from "@/components/relative-time";
import { ButtonLink, EmptyState, PageHeader, Section } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { getSpineRows, nextAlbumStep } from "@/server/album-songs";
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

export default async function AppHomePage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const albums = await listAlbums(workspace.id);
  const latest = albums[0] ? await getAlbum(workspace.id, albums[0].id) : null;
  const latestRows = latest ? getSpineRows(latest.data) : [];
  // The same next step the album's release header shows, so the two never disagree.
  const step = latest ? nextAlbumStep(latest.id, latest.data) : null;
  const stepTitle = step?.trackTitle ?? null;

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
                className="type-display inline-block max-w-full break-words py-2 text-2xl text-ink hyphens-auto underline-offset-4 hover:underline md:text-4xl"
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
      ) : null}

      <Section
        id="recent"
        title="Recent albums"
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
