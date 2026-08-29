"use client";

import { useMemo, useState } from "react";

type ExportFormat = "midi" | "chordpro" | "musicxml" | "json" | "text";

const ALL_FORMATS: Array<{
  key: ExportFormat;
  title: string;
  desc: string;
}> = [
  { key: "midi", title: "MIDI", desc: "Chord progressions + basic timing for DAWs" },
  { key: "chordpro", title: "ChordPro", desc: "Lyrics with chords for OnSong / SongBook" },
  { key: "musicxml", title: "MusicXML", desc: "Notation for MuseScore / Finale / Sibelius" },
  { key: "json", title: "JSON", desc: "Full project data (album.json)" },
  { key: "text", title: "Text", desc: "Tracklist as plain text" },
];

export function AlbumExport({ albumId }: { albumId: string }) {
  const [selected, setSelected] = useState<Set<ExportFormat>>(
    () => new Set<ExportFormat>(["midi", "chordpro", "json"]),
  );
  const [includeProductionNotes, setIncludeProductionNotes] = useState(true);
  const [status, setStatus] = useState<string>("");

  const query = useMemo(() => {
    const formats = Array.from(selected);
    const params = new URLSearchParams();
    params.set("formats", formats.join(","));
    if (includeProductionNotes) params.set("production_notes", "1");
    return params.toString();
  }, [selected, includeProductionNotes]);

  const handoffDownloads = useMemo(
    () => [
      {
        key: "suno",
        title: "Suno brief",
        desc: "Album-level prompt pack with per-track prompt lines and negative prompt guidance.",
      },
      {
        key: "udio",
        title: "Udio brief",
        desc: "Section-aware handoff notes built for Udio-style iteration and extension workflows.",
      },
      {
        key: "daw",
        title: "DAW session notes",
        desc: "Arrangement, recording, and mix priorities for a producer or session file handoff.",
      },
    ] as const,
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs text-[var(--muted2)]">Export</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Export your album
        </div>
        <div className="mt-2 max-w-[72ch] text-sm text-[var(--muted)]">
          This downloads a zip bundle created by the Python export engine. Select formats and hit
          download.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-sm font-semibold text-[var(--text)]">Formats</div>
          <div className="mt-3 space-y-2">
            {ALL_FORMATS.map((fmt) => {
              const checked = selected.has(fmt.key);
              const inputId = `export-format-${fmt.key}`;
              return (
                <label
                  key={fmt.key}
                  htmlFor={inputId}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3 hover:bg-[rgba(0,0,0,0.24)]"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    aria-label={fmt.title}
                    checked={checked}
                    onChange={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(fmt.key)) next.delete(fmt.key);
                        else next.add(fmt.key);
                        return next;
                      });
                    }}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{fmt.title}</div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">{fmt.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-sm font-semibold text-[var(--text)]">Options</div>
          <div className="mt-3 space-y-3">
            <label
              htmlFor="include-production-notes"
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3 hover:bg-[rgba(0,0,0,0.24)]"
            >
              <input
                id="include-production-notes"
                type="checkbox"
                aria-label="Include production notes"
                checked={includeProductionNotes}
                onChange={() => setIncludeProductionNotes((v) => !v)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">
                  Include production notes
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  Adds extra context in exporters that support it.
                </div>
              </div>
            </label>

            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                if (!selected.size) return;
                setStatus("Preparing download...");
                window.location.href = `/api/albums/${albumId}/export?${query}`;
                window.setTimeout(() => setStatus(""), 1500);
              }}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download zip
            </button>

            {status ? <div className="text-xs text-[var(--muted2)]">{status}</div> : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--muted2)]">Handoff packs</div>
            <div className="mt-1 text-sm font-semibold text-[var(--text)]">
              Generator + DAW briefs from your album system
            </div>
          </div>
          <div className="text-xs text-[var(--muted2)]">
            Uses Bible, coherence, references, and style-bible guidance
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {handoffDownloads.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-4"
            >
              <div className="text-sm font-semibold text-[var(--text)]">{item.title}</div>
              <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.desc}</div>
              <a
                href={`/api/albums/${albumId}/handoff?target=${item.key}`}
                onClick={() => {
                  setStatus(`Preparing ${item.title.toLowerCase()}...`);
                  window.setTimeout(() => setStatus(""), 1800);
                }}
                className="mt-4 inline-flex rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                Download {item.title}
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
