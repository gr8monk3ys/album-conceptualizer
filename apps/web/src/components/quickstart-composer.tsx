"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function splitTrackNames(raw: string): string[] {
  return raw
    .split(/\r?\n|,/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

const COMMON_PROGRESSIONS: Array<{ key: string; chords: string[] }> = [
  { key: "C", chords: ["C", "G", "Am", "F"] }, // I–V–vi–IV
  { key: "A minor", chords: ["Am", "F", "C", "G"] }, // vi–IV–I–V
  { key: "G", chords: ["G", "D", "Em", "C"] }, // I–V–vi–IV
  { key: "D minor", chords: ["Dm", "Bb", "F", "C"] }, // i–VI–III–VII
];

function buildAlbumJson(input: {
  title: string;
  artist: string;
  conceptSummary: string;
  trackCount: number;
  trackNamesRaw: string;
}) {
  const now = new Date().toISOString();
  const trackNames = splitTrackNames(input.trackNamesRaw);

  const songs = Array.from({ length: input.trackCount }, (_, i) => {
    const trackNumber = i + 1;
    const title = trackNames[i] || `Track ${trackNumber}`;
    const progression = COMMON_PROGRESSIONS[i % COMMON_PROGRESSIONS.length] ?? COMMON_PROGRESSIONS[0];
    return {
      id: crypto.randomUUID(),
      title,
      track_number: trackNumber,
      key: progression.key,
      tempo: 120,
      sections: [
        {
          id: crypto.randomUUID(),
          section_type: "verse",
          order: 1,
          lyrics: "[Verse line 1]\n[Verse line 2]\n[Verse line 3]\n[Verse line 4]",
          chord_progression: progression.chords,
        },
        {
          id: crypto.randomUUID(),
          section_type: "chorus",
          order: 2,
          lyrics: "[Chorus line 1]\n[Chorus line 2]\n[Chorus line 3]\n[Chorus line 4]",
          chord_progression: progression.chords,
        },
      ],
      time_signature: "4/4",
      themes: [],
      motifs: [],
      characters: [],
      genre_tags: [],
      mood_tags: [],
      reference_tracks: [],
      instrumentation: [],
    };
  });

  return {
    id: crypto.randomUUID(),
    title: input.title,
    artist: input.artist || null,
    songs,
    created_at: now,
    updated_at: now,
    concept_summary: input.conceptSummary || null,
    narrative_structure: null,
    primary_genre: null,
    secondary_genres: [],
    era_influence: null,
    release_year: null,
    central_themes: [],
    recurring_motifs: [],
    reference_albums: [],
    visual_inspiration: [],
  };
}

export function QuickStartComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [conceptSummary, setConceptSummary] = useState("");
  const [trackCount, setTrackCount] = useState(10);
  const [trackNamesRaw, setTrackNamesRaw] = useState("");
  const [albumJson, setAlbumJson] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const jsonText = useMemo(() => {
    if (!albumJson) return "";
    return JSON.stringify(albumJson, null, 2);
  }, [albumJson]);

  function downloadAlbumJson() {
    if (!jsonText) return;
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "album.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyToClipboard() {
    if (!jsonText) return;
    await navigator.clipboard.writeText(jsonText);
    setStatus("Copied album.json to clipboard.");
    window.setTimeout(() => setStatus(""), 1500);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--muted2)]">Quick start</div>
            <div className="text-lg font-semibold tracking-tight text-[var(--text)]">
              Generate album.json
            </div>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
            v0.1
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="text-xs font-semibold text-[var(--text)]">Album title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              placeholder="e.g., The Last Summer"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-[var(--text)]">Artist</div>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              placeholder="e.g., The Storytellers"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-[var(--text)]">Concept summary</div>
            <textarea
              value={conceptSummary}
              onChange={(e) => setConceptSummary(e.target.value)}
              className="mt-2 min-h-[110px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              placeholder="One or two sentences about the album concept..."
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[var(--text)]">Track count</div>
              <div className="text-xs text-[var(--muted)]">{trackCount}</div>
            </div>
            <input
              type="range"
              min={4}
              max={20}
              value={trackCount}
              onChange={(e) => setTrackCount(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-[var(--text)]">Track names (optional)</div>
            <textarea
              value={trackNamesRaw}
              onChange={(e) => setTrackNamesRaw(e.target.value)}
              className="mt-2 min-h-[90px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              placeholder="One per line or comma-separated"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (!title.trim()) {
                setStatus("Album title is required.");
                window.setTimeout(() => setStatus(""), 2000);
                return;
              }
              setAlbumJson(
                buildAlbumJson({
                  title: title.trim(),
                  artist: artist.trim(),
                  conceptSummary: conceptSummary.trim(),
                  trackCount,
                  trackNamesRaw,
                }),
              );
              setStatus("Generated album.json.");
              window.setTimeout(() => setStatus(""), 1500);
            }}
            className="w-full rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-4 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(255,62,165,0.15)] hover:brightness-110"
          >
            Generate album.json
          </button>

          {status ? <div className="text-xs text-[var(--muted2)]">{status}</div> : null}

          <div className="text-xs text-[var(--muted2)]">
            This produces a JSON compatible with the existing Python `Album` model. Next steps: save
            to Neon, run AI agents, and export to MIDI/ChordPro/MusicXML.
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--muted2)]">Generated output</div>
            <div className="text-sm font-semibold text-[var(--text)]">album.json</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!albumJson) return;
                setIsSaving(true);
                try {
                  const response = await fetch("/api/albums", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ album: albumJson }),
                  });
                  if (!response.ok) {
                    const body = (await response.json().catch(() => null)) as
                      | { error?: string }
                      | null;
                    throw new Error(body?.error || "Failed to save project.");
                  }
                  const saved = (await response.json()) as { id: string };
                  setStatus("Saved to workspace.");
                  router.push(`/app/albums/${saved.id}`);
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Failed to save project.";
                  setStatus(message);
                  window.setTimeout(() => setStatus(""), 2500);
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={!albumJson || isSaving}
              className="rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-3 py-2 text-xs font-semibold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!albumJson}
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={downloadAlbumJson}
              disabled={!albumJson}
              className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.12)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[rgba(0,0,0,0.35)] p-3">
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted)]">
            {jsonText || "Generate an album.json to preview it here."}
          </pre>
        </div>
      </section>
    </div>
  );
}
