import Link from "next/link";

import { AlbumCard, type AlbumListItem } from "@/components/album-card";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

function normalizeQuery(value: string | string[] | undefined) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return "";
}

function snippet(text: string, q: string) {
  const maxLen = 140;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const idx = normalized.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return normalized.slice(0, maxLen) + (normalized.length > maxLen ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(normalized.length, idx + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

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

  const [albums, songs, sections] = await Promise.all([
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
            primaryGenre: true,
            trackCount: true,
            coverUrl: true,
            status: true,
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
            album: {
              select: { id: true, title: true },
            },
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
  ]);

  const albumItems: AlbumListItem[] = albums.map((album) => ({
    id: album.id,
    title: album.title,
    subtitle: `${album.primaryGenre || "Concept"} | ${album.trackCount} tracks`,
    tag: album.status === "draft" ? "draft" : undefined,
    cover: album.coverUrl ?? undefined,
  }));

  const totalHits = albumItems.length + songs.length + sections.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-xs text-[var(--muted2)]">Search</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Find anything
        </div>
        <div className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
          Search titles, summaries, track names, and lyrics drafts inside this workspace.
        </div>
      </div>

      <form
        action="/app/search"
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4"
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs text-[var(--muted2)]">Query</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search: album title, song name, lyric line…"
            className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-[var(--muted2)]">
            {shouldSearch ? `${totalHits} hits` : "Type at least 2 characters"}
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Search
          </button>
        </div>
      </form>

      {shouldSearch ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
          <section className="space-y-3">
            <div className="text-xs text-[var(--muted2)]">Projects</div>
            {albumItems.length ? (
              <div className="grid grid-cols-1 gap-3">
                {albumItems.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    href={`/app/albums/${album.id}/studio?q=${encodeURIComponent(q)}`}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-5 text-sm text-[var(--muted)]">
                No matching projects.
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs text-[var(--muted2)]">Tracks</div>
              <div className="mt-2 space-y-2">
                {songs.length ? (
                  songs.map((song) => (
                    <Link
                      key={song.id}
                      href={`/app/albums/${song.album.id}/studio?song=${song.trackNumber}&q=${encodeURIComponent(q)}`}
                      className="block rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 hover:bg-[rgba(255,255,255,0.05)]"
                    >
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {song.title}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted2)]">
                        {song.album.title} · Track {song.trackNumber}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-[var(--muted)]">No matching tracks.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs text-[var(--muted2)]">Lyrics</div>
              <div className="mt-2 space-y-2">
                {sections.length ? (
                  sections.map((section) => (
                    <Link
                      key={section.id}
                      href={`/app/albums/${section.song.album.id}/studio?song=${section.song.trackNumber}&section=${section.order}&q=${encodeURIComponent(
                        q,
                      )}`}
                      className="block rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 hover:bg-[rgba(255,255,255,0.05)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--text)]">
                          {section.song.title}
                        </div>
                        <div className="text-xs text-[var(--muted2)]">
                          {section.sectionType} #{section.order + 1}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted2)]">
                        {section.song.album.title} · Track {section.song.trackNumber}
                      </div>
                      {section.lyrics ? (
                        <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                          {snippet(section.lyrics, q)}
                        </div>
                      ) : null}
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-[var(--muted)]">No matching lyric drafts.</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

