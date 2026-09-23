import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { BibleActions } from "@/components/bible-actions";
import { getAlbum } from "@/server/albums";
import { buildAlbumBible } from "@/server/bible";
import { buildMotifCharacterGraph, type MotifCharacterGraph } from "@/server/bible-relationships";
import { requireUser } from "@/server/identity";
import { summarizeStyleBible } from "@/server/style-bible";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album Bible",
  description: "View themes, motifs, characters, and relationship maps for your album.",
};

function Tag({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line-strong bg-raised px-2 py-0.5 text-[10px] font-semibold text-ink-2">
      {children}
    </span>
  );
}

function RelationshipMap({ graph }: { graph: MotifCharacterGraph }) {
  if (!graph.characters.length || !graph.motifs.length) {
    return (
      <div className="text-sm text-ink-2">
        Tag characters and motifs on tracks to see a relationship map.
      </div>
    );
  }

  const chars = graph.characters;
  const motifs = graph.motifs;
  const edges = graph.edges.slice(0, 120);

  const row = 34;
  const padY = 26;
  const viewW = 1000;
  const viewH = Math.max(chars.length, motifs.length) * row + padY * 2;

  const leftX = 220;
  const rightX = 780;
  const leftLabelX = 16;
  const rightLabelX = 984;

  const yForIndex = (idx: number) => padY + idx * row + row / 2;

  const charY = new Map<string, number>();
  for (let i = 0; i < chars.length; i += 1) {
    charY.set(chars[i]?.name ?? "", yForIndex(i));
  }
  const motifY = new Map<string, number>();
  for (let i = 0; i < motifs.length; i += 1) {
    motifY.set(motifs[i]?.name ?? "", yForIndex(i));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-2xl border border-line bg-sunken">
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          className="min-w-[680px] text-ink-3"
          role="img"
          aria-label="Character to motif relationship map"
        >
          <defs>
            <linearGradient id="acEdge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(109,94,252,0.55)" />
              <stop offset="100%" stopColor="rgba(255,62,165,0.45)" />
            </linearGradient>
          </defs>

          {edges.map((edge) => {
            const y1 = charY.get(edge.character);
            const y2 = motifY.get(edge.motif);
            if (!y1 || !y2) return null;
            const w = Math.min(6, 1 + edge.weight * 1.2);
            const op = Math.min(0.85, 0.22 + edge.weight * 0.18);
            return (
              <line
                key={`${edge.character}::${edge.motif}`}
                x1={leftX}
                y1={y1}
                x2={rightX}
                y2={y2}
                stroke="url(#acEdge)"
                strokeWidth={w}
                opacity={op}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {edge.character} ↔ {edge.motif} (tracks: {edge.trackNumbers.join(", ")})
                </title>
              </line>
            );
          })}

          {chars.map((c, idx) => {
            const y = yForIndex(idx);
            return (
              <g key={`c-${c.name}`}>
                <circle cx={leftX} cy={y} r={6} fill="rgba(255,255,255,0.55)" />
                <text
                  x={leftLabelX}
                  y={y + 4}
                  fontSize={14}
                  fill="rgba(255,255,255,0.86)"
                  textAnchor="start"
                >
                  {c.name}
                </text>
              </g>
            );
          })}

          {motifs.map((m, idx) => {
            const y = yForIndex(idx);
            return (
              <g key={`m-${m.name}`}>
                <circle cx={rightX} cy={y} r={6} fill="rgba(255,255,255,0.45)" />
                <text
                  x={rightLabelX}
                  y={y + 4}
                  fontSize={14}
                  fill="rgba(255,255,255,0.86)"
                  textAnchor="end"
                >
                  {m.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {graph.edges.length ? (
        <div className="space-y-2">
          {graph.edges.slice(0, 10).map((edge) => (
            <div
              key={`edge-${edge.character}-${edge.motif}`}
              className="rounded-2xl border border-line bg-sunken px-4 py-2"
            >
              <div className="text-xs font-semibold text-ink">
                {edge.character} <span className="text-ink-3">↔</span> {edge.motif}
              </div>
              <div className="mt-1 text-[10px] text-ink-3">
                Tracks {edge.trackNumbers.join(", ")}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type AlbumBiblePageProps = { params: Promise<{ albumId: string }> };

async function renderAlbumBiblePage({ params }: AlbumBiblePageProps) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const bible = buildAlbumBible(album.data);
  const styleSummary = summarizeStyleBible(bible.styleBible);
  const graph = buildMotifCharacterGraph(bible, { maxCharacters: 10, maxMotifs: 10, minEdgeWeight: 1 });
  const gridCols =
    bible.themeGrid.tracks.length > 0
      ? `240px repeat(${bible.themeGrid.tracks.length}, minmax(44px, 1fr))`
      : "1fr";

  const warnings = bible.issues.filter((i) => i.level === "warn");
  const infos = bible.issues.filter((i) => i.level === "info");

  return (
    <div className="flex flex-col gap-5">
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_bible_viewed"
        path={`/app/albums/${album.id}/bible`}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-ink-3">Bible</div>
          <div className="text-2xl font-semibold tracking-tight text-ink">
            {bible.title}
          </div>
          <div className="mt-1 text-sm text-ink-2">
            {bible.artist ? `by ${bible.artist}` : "Artist not set"}
            {bible.primaryGenre ? ` · ${bible.primaryGenre}` : ""}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/albums/${album.id}`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            Back
          </Link>
          <Link
            href={`/app/albums/${album.id}/studio`}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Studio
          </Link>
          <Link
            href={`/app/albums/${album.id}/references`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            References
          </Link>
          <Link
            href={`/app/albums/${album.id}/style`}
            className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            Style
          </Link>
          <BibleActions albumId={album.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Logline</div>
            <div className="mt-2 text-sm leading-relaxed text-ink-2">
              {bible.conceptSummary || "Add a concept summary in Studio to anchor this bible."}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Voice / style bible</div>
                <div className="mt-1 text-sm font-semibold text-ink">
                  {styleSummary.score}/100 coverage
                </div>
              </div>
              <Link
                href={`/app/albums/${album.id}/style`}
                className="rounded-full border border-line bg-raised px-3 py-2 text-xs font-semibold text-ink hover:bg-hover"
              >
                Open workspace
              </Link>
            </div>

            <div className="mt-3 text-sm leading-relaxed text-ink-2">
              {bible.styleBible.lead_voice || "No lead voice brief set yet."}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                  Sonic palette
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bible.styleBible.sonic_palette.length ? (
                    bible.styleBible.sonic_palette.map((item) => (
                      <Tag key={`palette-${item}`}>{item}</Tag>
                    ))
                  ) : (
                    <div className="text-xs text-ink-2">No palette anchors set.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                  Mix priorities
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bible.styleBible.mix_priorities.length ? (
                    bible.styleBible.mix_priorities.map((item) => (
                      <Tag key={`mix-${item}`}>{item}</Tag>
                    ))
                  ) : (
                    <div className="text-xs text-ink-2">No mix priorities set.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Arc visualizer</div>
                <div className="mt-1 text-sm font-semibold text-ink">
                  Theme coverage ({bible.timeline.mode === "chronological" ? "chronological" : "track"}{" "}
                  order)
                </div>
              </div>
              <div className="text-xs text-ink-3">{bible.themeGrid.tracks.length} tracks</div>
            </div>

            {bible.themeGrid.tracks.length ? (
              <div className="mt-4 overflow-auto rounded-2xl border border-line bg-sunken">
                <div className="min-w-[760px]" style={{ display: "grid", gridTemplateColumns: gridCols }}>
                  <div className="sticky left-0 z-10 border-b border-line bg-sunken px-4 py-3 text-xs font-semibold text-ink-3">
                    Theme
                  </div>
                  {bible.themeGrid.tracks.map((track) => (
                    <div
                      key={track.trackNumber}
                      className="border-b border-line px-2 py-3 text-center text-[10px] font-semibold text-ink-3"
                      title={track.title}
                    >
                      {String(track.trackNumber).padStart(2, "0")}
                    </div>
                  ))}

                  {bible.themeGrid.rows.map((row) => (
                    <Fragment key={row.label}>
                      <div
                        key={`${row.label}-label`}
                        className="sticky left-0 z-10 border-b border-line bg-sunken px-4 py-3 text-xs font-semibold text-ink"
                      >
                        <div className="truncate">{row.label}</div>
                        <div className="mt-1 text-[10px] text-ink-3">
                          {row.trackNumbers.length ? `Tracks ${row.trackNumbers.join(", ")}` : "No tracks"}
                        </div>
                      </div>
                      {row.presence.map((present, idx) => (
                        <div
                          key={`${row.label}-${bible.themeGrid.tracks[idx]?.trackNumber ?? idx}`}
                          className="border-b border-line px-2 py-3"
                        >
                          <div
                            className={[
                              "mx-auto h-4 w-4 rounded-full",
                              present
                                ? "bg-[linear-gradient(180deg,rgba(109,94,252,0.95),rgba(255,62,165,0.7))] shadow-[0_8px_18px_rgba(109,94,252,0.18)]"
                                : "bg-hover",
                            ].join(" ")}
                          />
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-ink-2">No tracks found.</div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Timeline</div>
            <div className="mt-1 text-sm font-semibold text-ink">Story beats</div>

            <div className="mt-4 space-y-3">
              {bible.timeline.tracks.map((track) => (
                <div
                  key={track.trackNumber}
                  className="rounded-2xl border border-line bg-sunken p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-ink-3">
                        Track {track.trackNumber}
                        {typeof track.chronologicalOrder === "number"
                          ? ` · Chrono ${track.chronologicalOrder}`
                          : ""}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-ink">
                        {track.title}
                      </div>
                    </div>
                    <Link
                      href={`/app/albums/${album.id}/studio?song=${track.trackNumber}`}
                      className="rounded-2xl border border-line bg-raised px-3 py-2 text-[10px] font-semibold text-ink hover:bg-hover"
                    >
                      Open
                    </Link>
                  </div>

                  <div className="mt-3 text-xs leading-relaxed text-ink-2">
                    {track.narrativeSummary || "Add a narrative summary for this track."}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {track.themes.slice(0, 6).map((t) => (
                      <Tag key={`theme-${track.trackNumber}-${t}`}>{t}</Tag>
                    ))}
                    {track.motifs.slice(0, 4).map((m) => (
                      <Tag key={`motif-${track.trackNumber}-${m}`}>{m}</Tag>
                    ))}
                    {track.characters.slice(0, 4).map((c) => (
                      <Tag key={`char-${track.trackNumber}-${c}`}>{c}</Tag>
                    ))}
                  </div>

                  {track.sections.length ? (
                    <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {track.sections.slice(0, 6).map((section) => (
                        <div
                          key={`${track.trackNumber}-${section.order}-${section.sectionType}`}
                          className="rounded-2xl border border-line bg-raised px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-ink">
                              {section.sectionType} #{section.order + 1}
                            </div>
                            <div className="text-[10px] text-ink-3">
                              {section.chordCount ? `${section.chordCount} chords` : "no chords"}
                            </div>
                          </div>
                          {section.emotionalArc || section.narrativeFunction ? (
                            <div className="mt-1 text-[10px] text-ink-3">
                              {section.narrativeFunction ? `Role: ${section.narrativeFunction}` : ""}
                              {section.narrativeFunction && section.emotionalArc ? " · " : ""}
                              {section.emotionalArc ? `Arc: ${section.emotionalArc}` : ""}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-xs text-ink-3">No sections yet.</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Issues</div>
            <div className="mt-1 text-sm font-semibold text-ink">
              {warnings.length ? `${warnings.length} warnings` : "No warnings"}
            </div>

            <div className="mt-4 space-y-3">
              {warnings.length ? (
                warnings.slice(0, 8).map((issue) => (
                  <div
                    key={`${issue.level}-${issue.title}`}
                    className="rounded-2xl border border-accent bg-accent-soft px-4 py-3"
                  >
                    <div className="text-xs font-semibold text-ink">{issue.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-ink-2">
                      {issue.detail}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-ink-2">
                  No warnings detected. This bible will get more powerful as you add themes and
                  narrative notes.
                </div>
              )}
            </div>

            {infos.length ? (
              <div className="mt-5">
                <div className="text-xs font-semibold text-ink">Info</div>
                <div className="mt-2 space-y-2">
                  {infos.slice(0, 8).map((issue) => (
                    <div
                      key={`${issue.level}-${issue.title}`}
                      className="rounded-2xl border border-line bg-sunken px-4 py-3"
                    >
                      <div className="text-xs font-semibold text-ink">{issue.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-ink-2">
                        {issue.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Relationship map</div>
            <div className="mt-1 text-sm font-semibold text-ink">
              Characters × motifs
            </div>
            <div className="mt-3">
              <RelationshipMap graph={graph} />
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Characters</div>
            <div className="mt-2 space-y-2">
              {bible.characterIndex.length ? (
                bible.characterIndex.slice(0, 14).map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-sunken px-4 py-2"
                  >
                    <div className="truncate text-xs font-semibold text-ink">
                      {entry.name}
                    </div>
                    <div className="text-[10px] text-ink-3">
                      {entry.trackNumbers.join(", ")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-ink-2">No characters tagged yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Motifs</div>
            <div className="mt-2 space-y-2">
              {bible.motifIndex.length ? (
                bible.motifIndex.slice(0, 14).map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-sunken px-4 py-2"
                  >
                    <div className="truncate text-xs font-semibold text-ink">
                      {entry.name}
                    </div>
                    <div className="text-[10px] text-ink-3">
                      {entry.trackNumbers.join(", ")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-ink-2">No motifs tagged yet.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default async function AlbumBiblePage(props: AlbumBiblePageProps) {
  return renderAlbumBiblePage(props);
}
