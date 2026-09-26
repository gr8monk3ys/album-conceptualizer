import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { AlbumList, toAlbumListItem } from "@/components/album-card";
import { Button, EmptyState, Field, PageHeader, Section, inputClass } from "@/components/ui";
import { findTagMatches, searchSnippet, type TagMatch } from "@/lib/search-match";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Search",
  description: "Find albums, songs and lyric lines across your workspace.",
};

function normalizeQuery(value: string | string[] | undefined) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return "";
}

function sectionName(type: string) {
  const words = type.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Section";
}

/** Where a matching tag is edited: the track's theme or motif tags, or the album's. */
function tagHref(match: TagMatch, qParam: string) {
  const base = `/app/albums/${match.albumId}/studio`;
  if (match.track) {
    const focus = match.kind === "theme" ? "song-themes" : "motifs";
    return `${base}?song=${match.track.number}&focus=${focus}&q=${qParam}`;
  }
  return `${base}?focus=${match.kind === "theme" ? "album" : "album-motifs"}&q=${qParam}`;
}

function tagLabel(match: TagMatch) {
  const kind = match.kind === "theme" ? "theme" : "motif";
  return match.track ? `Track ${kind}` : `Album ${kind}`;
}

const TAG_RESULT_LIMIT = 30;

// In a narrow list (a phone at 200% text) the track number sits above the text instead of
// beside it and the chevron goes, so the words get the whole width and never break inside
// themselves (the list is a size container).
const rowLink =
  "group flex min-h-11 items-center gap-4 px-1 py-3 transition-colors hover:bg-hover @max-[20rem]:flex-col @max-[20rem]:items-start @max-[20rem]:gap-1";
const rowChevron = "h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink @max-[20rem]:hidden";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = normalizeQuery(query.q);

  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const shouldSearch = q.length >= 2;
  const qParam = encodeURIComponent(q);

  const [albums, songs, sections, snapshots] = await Promise.all([
    shouldSearch
      ? prisma.album.findMany({
          where: {
            workspaceId: workspace.id,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { artist: { contains: q, mode: "insensitive" } },
              { conceptSummary: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            artist: true,
            trackCount: true,
            status: true,
            isPublic: true,
            updatedAt: true,
          },
        })
      : [],
    shouldSearch
      ? prisma.song.findMany({
          where: {
            album: { workspaceId: workspace.id },
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { narrativeSummary: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            trackNumber: true,
            narrativeSummary: true,
            album: { select: { id: true, title: true } },
          },
        })
      : [],
    shouldSearch
      ? prisma.section.findMany({
          where: {
            lyrics: { contains: q, mode: "insensitive" },
            song: { album: { workspaceId: workspace.id } },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            sectionType: true,
            order: true,
            lyrics: true,
            song: {
              select: {
                trackNumber: true,
                title: true,
                album: { select: { id: true, title: true } },
              },
            },
          },
        })
      : [],
    // Themes and motifs live only in the album snapshot, so tags are matched here, not in SQL.
    shouldSearch
      ? prisma.album.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: { id: true, title: true, data: true },
        })
      : [],
  ]);

  const tagMatches = findTagMatches(snapshots, q).slice(0, TAG_RESULT_LIMIT);
  const totalHits = albums.length + songs.length + tagMatches.length + sections.length;
  const tooShort = q.length === 1;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        size="page"
        title="Search"
        description="Find an album by title, artist or concept, a song by name or story note, a theme or motif you tagged, or a line you wrote in any lyric draft."
      />

      <form action="/app/search" method="get" role="search" aria-label="Workspace search" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <Field
            htmlFor="search-q"
            label="Search workspace"
            className="min-w-0 flex-1 basis-64"
            error={tooShort ? "Type at least 2 characters." : undefined}
          >
            <input
              id="search-q"
              name="q"
              type="search"
              defaultValue={q}
              autoComplete="off"
              spellCheck={false}
              placeholder="Album, song, theme or lyric line"
              aria-describedby={tooShort ? "search-q-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Button tone="secondary" type="submit">
            Search
          </Button>
        </div>
        {shouldSearch ? (
          <p className="max-w-[65ch] break-words text-sm text-ink-2" aria-live="polite">
            {totalHits} {totalHits === 1 ? "result" : "results"} for “{q}”
          </p>
        ) : null}
      </form>

      {!shouldSearch ? (
        <EmptyState title="Search everything you have written">
          <p>
            Results are grouped into albums, songs, themes and motifs, and lyrics. Lyric results
            open the Studio on the song and section where the line appears, so you can keep
            writing from there.
          </p>
        </EmptyState>
      ) : totalHits === 0 ? (
        <EmptyState title={`Nothing matches “${q}”`}>
          <p>
            Search looks at album titles, artists and concepts, song titles and story notes, album
            and track themes and motifs, and lyric drafts. Try a shorter phrase or a single
            distinctive word from a line.
          </p>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          {albums.length ? (
            <Section id="results-albums" title={`Albums (${albums.length})`}>
              <AlbumList
                label="Matching albums"
                albums={albums.map(toAlbumListItem)}
                hrefFor={(album) => `/app/albums/${album.id}/studio?q=${qParam}`}
              />
            </Section>
          ) : null}

          {songs.length ? (
            <Section id="results-songs" title={`Songs (${songs.length})`}>
              <ul aria-label="Matching songs" className="@container border-t border-line">
                {songs.map((song) => (
                  <li key={song.id} className="border-b border-line">
                    <Link
                      href={`/app/albums/${song.album.id}/studio?song=${song.trackNumber}&q=${qParam}`}
                      className={rowLink}
                    >
                      <span className="type-figure w-8 shrink-0 text-lg font-semibold text-ink-3">
                        {String(song.trackNumber).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 @max-[20rem]:w-full">
                        <span className="block break-words text-sm font-semibold text-ink">{song.title}</span>
                        <span className="type-catalog mt-1 block break-words text-xs text-ink-2">
                          {song.album.title} · Track {song.trackNumber}
                        </span>
                        {song.narrativeSummary ? (
                          <span className="mt-1 block max-w-[65ch] break-words text-sm text-ink-2">
                            {searchSnippet(song.narrativeSummary, q)}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight className={rowChevron} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {tagMatches.length ? (
            <Section id="results-tags" title={`Themes and motifs (${tagMatches.length})`}>
              <ul aria-label="Matching themes and motifs" className="@container border-t border-line">
                {tagMatches.map((match) => (
                  <li
                    key={`${match.albumId}-${match.track?.number ?? "album"}-${match.kind}-${match.tag}`}
                    className="border-b border-line"
                  >
                    <Link href={tagHref(match, qParam)} className={rowLink}>
                      <span className="type-figure w-8 shrink-0 text-lg font-semibold text-ink-3">
                        {match.track ? String(match.track.number).padStart(2, "0") : null}
                      </span>
                      <span className="min-w-0 flex-1 @max-[20rem]:w-full">
                        <span className="block break-words text-sm font-semibold text-ink">
                          {match.track ? match.track.title : match.albumTitle}
                        </span>
                        {match.track ? (
                          <span className="type-catalog mt-1 block break-words text-xs text-ink-2">
                            {match.albumTitle} · Track {match.track.number}
                          </span>
                        ) : null}
                        <span className="mt-1 block max-w-[65ch] break-words text-sm text-ink">
                          <span className="text-ink-2">{tagLabel(match)}: </span>
                          {match.tag}
                        </span>
                      </span>
                      <ChevronRight className={rowChevron} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {sections.length ? (
            <Section id="results-lyrics" title={`Lyrics (${sections.length})`}>
              <ul aria-label="Matching lyrics" className="@container border-t border-line">
                {sections.map((section) => (
                  <li key={section.id} className="border-b border-line">
                    <Link
                      href={`/app/albums/${section.song.album.id}/studio?song=${section.song.trackNumber}&section=${section.order}&q=${qParam}`}
                      className={rowLink}
                    >
                      <span className="type-figure w-8 shrink-0 text-lg font-semibold text-ink-3">
                        {String(section.song.trackNumber).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 @max-[20rem]:w-full">
                        <span className="block break-words text-sm font-semibold text-ink">
                          {section.song.title}
                          <span className="font-normal text-ink-2"> · {sectionName(section.sectionType)}</span>
                        </span>
                        <span className="type-catalog mt-1 block break-words text-xs text-ink-2">
                          {section.song.album.title} · Track {section.song.trackNumber}
                        </span>
                        {section.lyrics ? (
                          <span className="mt-1.5 block max-w-[65ch] break-words text-sm leading-relaxed text-ink">
                            {searchSnippet(section.lyrics, q)}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight className={rowChevron} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}
