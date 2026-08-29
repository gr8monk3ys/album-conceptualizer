"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Play, Plus, Save, Trash2 } from "lucide-react";

import type { AlbumJson } from "@/server/album-json";
import { SectionComments } from "@/components/section-comments";
import { SongDevelopmentAi } from "@/components/song-development-ai";
import { usePlayer } from "@/components/player/player-provider";

type SelectionInput = {
  song?: string;
  section?: string;
  sid?: string;
  q?: string;
};

function clampIndex(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(max - 1, Math.max(0, value));
}

function newId() {
  // Keep generated ids export-safe even in older browsers and test environments.
  try {
    return crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}

function parseChordProgression(raw: string): string[] {
  const tokens = raw
    .split(/[\n,]+/g)
    .flatMap((chunk) => chunk.split(/\s+/g))
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens;
}

function stringifyChordProgression(values: unknown): string {
  if (!Array.isArray(values)) return "";
  return values.filter((v) => typeof v === "string").join(" ");
}

function parseCentralThemes(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function buildNewSection(order: number) {
  return {
    id: newId(),
    section_type: "verse",
    order,
    lyrics: "",
    chord_progression: [],
    notes: "",
  };
}

function buildNewSong(trackNumber: number) {
  return {
    id: newId(),
    title: `Track ${trackNumber}`,
    track_number: trackNumber,
    key: null,
    tempo: null,
    narrative_summary: null,
    themes: [],
    motifs: [],
    characters: [],
    genre_tags: [],
    mood_tags: [],
    reference_tracks: [],
    instrumentation: [],
    sections: [buildNewSection(0)],
  };
}

function normalizeOrders<T extends { order: number }>(sections: T[]): T[] {
  return sections.map((section, index) => ({ ...section, order: index }));
}

function normalizeTrackNumbers<T extends { track_number: number }>(songs: T[]): T[] {
  return songs.map((song, index) => ({ ...song, track_number: index + 1 }));
}

type AlbumStudioProps = {
  albumId: string;
  initialAlbum: unknown;
  initialSelection?: SelectionInput;
};

function useAlbumStudioRender({ albumId, initialAlbum, initialSelection }: AlbumStudioProps) {
  const initialParsed = useMemo((): { album: AlbumJson; idsWereMissing: boolean } => {
    const fallback: AlbumJson = {
      id: newId(),
      title: "Untitled",
      artist: null,
      concept_summary: null,
      primary_genre: null,
      secondary_genres: [],
      era_influence: null,
      release_year: null,
      central_themes: [],
      recurring_motifs: [],
      reference_albums: [],
      visual_inspiration: [],
      rough_demos: [],
      songs: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!initialAlbum || typeof initialAlbum !== "object") {
      return { album: fallback, idsWereMissing: false };
    }

    const obj = initialAlbum as Partial<AlbumJson>;
    const rawSongs = Array.isArray(obj.songs) ? obj.songs : [];
    let idsWereMissing = false;

    const songs = rawSongs
      .map((song, songIndex) => {
        const sectionsRaw = Array.isArray(song?.sections) ? song.sections : [];
        const songId =
          typeof song?.id === "string" && song.id.trim().length > 0
            ? song.id
            : (() => {
                return newId();
              })();

        const sections = normalizeOrders(
          sectionsRaw
            .map((section, sectionIndex) => {
              const sectionId =
                typeof section?.id === "string" && section.id.trim().length > 0
                  ? section.id
                  : (() => {
                    idsWereMissing = true;
                    return newId();
                  })();

              const chordProgression = Array.isArray(section?.chord_progression)
                ? section.chord_progression
                : [];

              return {
                ...section,
                id: sectionId,
                order: typeof section?.order === "number" ? section.order : sectionIndex,
                chord_progression: chordProgression,
              };
            })
            .sort((a, b) => a.order - b.order),
        );

        return {
          ...song,
          id: songId,
          track_number:
            typeof song?.track_number === "number" ? song.track_number : songIndex + 1,
          themes: Array.isArray(song?.themes) ? song.themes : [],
          motifs: Array.isArray(song?.motifs) ? song.motifs : [],
          characters: Array.isArray(song?.characters) ? song.characters : [],
          genre_tags: Array.isArray(song?.genre_tags) ? song.genre_tags : [],
          mood_tags: Array.isArray(song?.mood_tags) ? song.mood_tags : [],
          reference_tracks: Array.isArray(song?.reference_tracks) ? song.reference_tracks : [],
          instrumentation: Array.isArray(song?.instrumentation) ? song.instrumentation : [],
          sections,
        };
      })
      .sort((a, b) => a.track_number - b.track_number);

    const albumIdFromJson =
      typeof obj.id === "string" && obj.id.trim().length > 0
        ? obj.id
        : (() => {
            return newId();
          })();

    return {
      idsWereMissing,
      album: {
        ...fallback,
        ...obj,
        id: albumIdFromJson,
        songs: normalizeTrackNumbers(songs),
        central_themes: Array.isArray(obj.central_themes) ? obj.central_themes : [],
        secondary_genres: Array.isArray(obj.secondary_genres) ? obj.secondary_genres : [],
        recurring_motifs: Array.isArray(obj.recurring_motifs) ? obj.recurring_motifs : [],
        reference_albums: Array.isArray(obj.reference_albums) ? obj.reference_albums : [],
        visual_inspiration: Array.isArray(obj.visual_inspiration) ? obj.visual_inspiration : [],
        rough_demos: Array.isArray(obj.rough_demos) ? obj.rough_demos : [],
      },
    };
  }, [initialAlbum]);

  const [album, setAlbum] = useState<AlbumJson>(initialParsed.album);
  const [selectedSong, setSelectedSong] = useState(0);
  const [selectedSection, setSelectedSection] = useState(0);
  const [centralThemesText, setCentralThemesText] = useState(() =>
    (initialParsed.album.central_themes ?? []).join(", "),
  );
  const [versionMessage, setVersionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [stableIdsPersisted, setStableIdsPersisted] = useState(!initialParsed.idsWereMissing);
  const [previewing, setPreviewing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);

  const player = usePlayer();

  const songs = useMemo(() => album.songs ?? [], [album.songs]);
  const activeSong = songs[selectedSong];
  const sections = useMemo(() => activeSong?.sections ?? [], [activeSong?.sections]);
  const activeSection = sections[selectedSection];

  useEffect(() => {
    const desiredTrack =
      initialSelection?.song && /^\d+$/.test(initialSelection.song)
        ? Number(initialSelection.song)
        : null;
    if (!desiredTrack) return;

    const index = songs.findIndex((song) => song.track_number === desiredTrack);
    if (index >= 0) setSelectedSong(index);
  }, [initialSelection?.song, songs]);

  useEffect(() => {
    const desiredSid = initialSelection?.sid?.trim();
    if (!desiredSid) return;
    const index = sections.findIndex((section) => section.id === desiredSid);
    if (index >= 0) setSelectedSection(index);
  }, [initialSelection?.sid, sections]);

  useEffect(() => {
    if (initialSelection?.sid) return;
    const desiredOrder =
      initialSelection?.section && /^\d+$/.test(initialSelection.section)
        ? Number(initialSelection.section)
        : null;
    if (desiredOrder == null) return;

    const index = sections.findIndex((section) => section.order === desiredOrder);
    if (index >= 0) setSelectedSection(index);
  }, [initialSelection?.section, initialSelection?.sid, sections]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    setCentralThemesText((album.central_themes ?? []).join(", "));
  }, [album.central_themes]);

  function markDirty() {
    setDirty(true);
    setStatus(null);
  }

  function selectSong(index: number) {
    setSelectedSong(clampIndex(index, songs.length));
    setSelectedSection(0);
  }

  function selectSection(index: number) {
    setSelectedSection(clampIndex(index, sections.length));
  }

  async function previewFromChords(chords: string[], opts: { title: string; subtitle: string }) {
    setPreviewing(true);
    setPreviewStatus(null);

    // Best-effort: unlock audio on this click. If it fails, we can still load the preview and
    // the user can press Play in the playerbar to start audio.
    void player.arm().catch(() => null);

    try {
      const response = await fetch("/api/midi/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chords,
          tempo: activeSong?.tempo ?? 120,
          barsPerChord: 1,
          title: opts.title,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Preview failed (${response.status}).`);
      }

      const midi = await response.arrayBuffer();
      await player.loadMidi({ midi, title: opts.title, subtitle: opts.subtitle });

      try {
        await player.play();
      } catch {
        setPreviewStatus("Preview loaded. Press Play in the playerbar to start audio.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Preview failed.";
      setPreviewStatus(message);
    } finally {
      setPreviewing(false);
    }
  }

  async function downloadMp3FromChords(chords: string[], opts: { title: string; subtitle: string }) {
    setPreviewing(true);
    setPreviewStatus(null);
    try {
      const response = await fetch("/api/audio/preview/mp3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chords,
          tempo: activeSong?.tempo ?? 120,
          barsPerChord: 1,
          title: opts.title,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `MP3 render failed (${response.status}).`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const safe = `${opts.title} ${opts.subtitle}`.trim() || "preview";
      const filename = `${safe.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_")}.mp3`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setPreviewStatus("MP3 downloaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "MP3 render failed.";
      setPreviewStatus(message);
    } finally {
      setPreviewing(false);
    }
  }

  async function previewSection() {
    if (!activeSong || !activeSection) return;
    const chords = Array.isArray(activeSection.chord_progression)
      ? activeSection.chord_progression.map((c) => String(c).trim()).filter(Boolean)
      : [];
    if (!chords.length) {
      setPreviewStatus("Add a chord progression to preview.");
      return;
    }
    await previewFromChords(chords, {
      title: activeSong.title || `Track ${activeSong.track_number}`,
      subtitle: `${activeSection.section_type} #${activeSection.order + 1}`,
    });
  }

  async function previewSong() {
    if (!activeSong) return;
    const chords = Array.isArray(activeSong.sections)
      ? activeSong.sections.flatMap((section) =>
          Array.isArray(section.chord_progression)
            ? section.chord_progression.map((c) => String(c).trim()).filter(Boolean)
            : [],
        )
      : [];
    if (!chords.length) {
      setPreviewStatus("Add chord progressions to preview this track.");
      return;
    }
    await previewFromChords(chords, {
      title: activeSong.title || `Track ${activeSong.track_number}`,
      subtitle: "Full track preview",
    });
  }

  async function downloadSectionMp3() {
    if (!activeSong || !activeSection) return;
    const chords = Array.isArray(activeSection.chord_progression)
      ? activeSection.chord_progression.map((c) => String(c).trim()).filter(Boolean)
      : [];
    if (!chords.length) {
      setPreviewStatus("Add a chord progression to render MP3.");
      return;
    }
    await downloadMp3FromChords(chords, {
      title: activeSong.title || `Track ${activeSong.track_number}`,
      subtitle: `${activeSection.section_type} #${activeSection.order + 1}`,
    });
  }

  async function save(opts?: { withVersion?: boolean }) {
    setSaving(true);
    setStatus(null);
    try {
      const body = {
        album: {
          ...album,
          central_themes: parseCentralThemes(centralThemesText),
        },
        versionMessage: opts?.withVersion ? versionMessage.trim() || undefined : undefined,
      };

      const response = await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Save failed (${response.status}).`);
      }

      setAlbum((prev) => ({
        ...prev,
        updated_at: new Date().toISOString(),
        central_themes: parseCentralThemes(centralThemesText),
      }));
      setDirty(false);
      setStableIdsPersisted(true);
      setVersionMessage("");
      setStatus(opts?.withVersion ? "Saved + versioned." : "Saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  }

  function addTrack() {
    setAlbum((prev) => {
      const nextTrackNumber = (prev.songs?.length ?? 0) + 1;
      const nextSongs = [...(prev.songs ?? []), buildNewSong(nextTrackNumber)];
      return { ...prev, songs: nextSongs };
    });
    markDirty();
    setSelectedSong(songs.length);
    setSelectedSection(0);
  }

  function deleteTrack(index: number) {
    setAlbum((prev) => {
      const nextSongs = [...(prev.songs ?? [])];
      nextSongs.splice(index, 1);
      const normalized = normalizeTrackNumbers(nextSongs);
      return { ...prev, songs: normalized };
    });
    markDirty();
    selectSong(Math.max(0, index - 1));
  }

  function updateSongField<K extends keyof NonNullable<AlbumJson["songs"]>[number]>(
    key: K,
    value: NonNullable<AlbumJson["songs"]>[number][K],
  ) {
    setAlbum((prev) => {
      const nextSongs = [...(prev.songs ?? [])];
      const current = nextSongs[selectedSong];
      if (!current) return prev;
      nextSongs[selectedSong] = { ...current, [key]: value };
      return { ...prev, songs: nextSongs };
    });
    markDirty();
  }

  function updateSectionField<K extends keyof NonNullable<
    NonNullable<AlbumJson["songs"]>[number]["sections"]
  >[number]>(
    key: K,
    value: NonNullable<NonNullable<AlbumJson["songs"]>[number]["sections"]>[number][K],
  ) {
    setAlbum((prev) => {
      const nextSongs = [...(prev.songs ?? [])];
      const song = nextSongs[selectedSong];
      if (!song) return prev;
      const nextSections = [...(song.sections ?? [])];
      const section = nextSections[selectedSection];
      if (!section) return prev;
      nextSections[selectedSection] = { ...section, [key]: value };
      nextSongs[selectedSong] = { ...song, sections: nextSections };
      return { ...prev, songs: nextSongs };
    });
    markDirty();
  }

  function addSection() {
    setAlbum((prev) => {
      const nextSongs = [...(prev.songs ?? [])];
      const song = nextSongs[selectedSong];
      if (!song) return prev;
      const nextSections = [...(song.sections ?? []), buildNewSection(song.sections?.length ?? 0)];
      nextSongs[selectedSong] = { ...song, sections: normalizeOrders(nextSections) };
      return { ...prev, songs: nextSongs };
    });
    markDirty();
    setSelectedSection(sections.length);
  }

  function deleteSection(index: number) {
    setAlbum((prev) => {
      const nextSongs = [...(prev.songs ?? [])];
      const song = nextSongs[selectedSong];
      if (!song) return prev;
      const nextSections = [...(song.sections ?? [])];
      nextSections.splice(index, 1);
      nextSongs[selectedSong] = { ...song, sections: normalizeOrders(nextSections) };
      return { ...prev, songs: nextSongs };
    });
    markDirty();
    selectSection(Math.max(0, index - 1));
  }

  function moveSection(index: number, dir: -1 | 1) {
    setAlbum((prev) => {
      const nextSongs = [...(prev.songs ?? [])];
      const song = nextSongs[selectedSong];
      if (!song) return prev;
      const nextSections = [...(song.sections ?? [])];
      const target = index + dir;
      if (target < 0 || target >= nextSections.length) return prev;
      const temp = nextSections[index];
      nextSections[index] = nextSections[target];
      nextSections[target] = temp;
      nextSongs[selectedSong] = { ...song, sections: normalizeOrders(nextSections) };
      return { ...prev, songs: nextSongs };
    });
    markDirty();
    setSelectedSection((prev) => clampIndex(prev + dir, sections.length));
  }

  const showEmpty = !songs.length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr_360px]">
      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-[var(--muted2)]">Tracks</div>
            <div className="text-sm font-semibold text-[var(--text)]">Song list</div>
          </div>
          <button
            type="button"
            onClick={addTrack}
            className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(255,255,255,0.07)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.10)]"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
          {songs.length ? (
            <div className="max-h-[560px] overflow-auto">
              <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
                {songs.map((song, index) => {
                  const isActive = index === selectedSong;
                  return (
                    <li key={song.id ?? `${song.track_number}-${song.title}`}>
                      <button
                        type="button"
                        onClick={() => selectSong(index)}
                        className={[
                          "w-full px-4 py-3 text-left",
                          isActive
                            ? "bg-[linear-gradient(90deg,rgba(109,94,252,0.18),rgba(255,62,165,0.10))]"
                            : "hover:bg-[rgba(255,255,255,0.04)]",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 text-xs tabular-nums text-[var(--muted2)]">
                            {String(song.track_number).padStart(2, "0")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--text)]">
                              {song.title}
                            </div>
                            <div className="truncate text-xs text-[var(--muted2)]">
                              {song.sections?.length ?? 0} sections
                            </div>
                          </div>
                          <div className="text-xs text-[var(--muted2)]">
                            {song.tempo ? `${song.tempo} bpm` : ""}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No songs yet. Add a track to start writing.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
        {showEmpty ? (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 text-sm text-[var(--muted)]">
            Add a track on the left to begin.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Editing</div>
                <div className="text-sm font-semibold text-[var(--text)]">
                  Track {activeSong?.track_number}: {activeSong?.title}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SongDevelopmentAi
                  albumId={albumId}
                  songTitle={activeSong?.title ?? `Track ${activeSong?.track_number ?? 1}`}
                  trackNumber={activeSong?.track_number ?? 1}
                />
                <button
                  type="button"
                  onClick={() => void previewSong()}
                  disabled={previewing}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="h-4 w-4" />
                  Preview song
                </button>
                <Link
                  href={`/app/albums/${albumId}`}
                  className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  Details
                </Link>
                <button
                  type="button"
                  onClick={() => deleteTrack(selectedSong)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,62,165,0.12)]"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete track
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--muted2)]">Title</span>
                <input
                  value={activeSong?.title ?? ""}
                  onChange={(e) => updateSongField("title", e.target.value)}
                  className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--muted2)]">Key</span>
                  <input
                    value={activeSong?.key ?? ""}
                    onChange={(e) => updateSongField("key", e.target.value || null)}
                    className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                    placeholder="C minor"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--muted2)]">Tempo</span>
                  <input
                    value={activeSong?.tempo ?? ""}
                    onChange={(e) => {
                      const next = e.target.value.trim();
                      updateSongField("tempo", next ? Number(next) : null);
                    }}
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                    placeholder="120"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-[var(--muted2)]">Sections</div>
                  <div className="text-sm font-semibold text-[var(--text)]">
                    Structure + drafts
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(255,255,255,0.07)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.10)]"
                >
                  <Plus className="h-4 w-4" />
                  Add section
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr]">
                <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
                  {sections.length ? (
                    <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
                      {sections.map((section, index) => {
                        const isActive = index === selectedSection;
                        return (
                          <li key={section.id ?? `${section.section_type}-${section.order}`}>
                            <button
                              type="button"
                              onClick={() => selectSection(index)}
                              className={[
                                "w-full px-3 py-2 text-left text-sm",
                                isActive
                                  ? "bg-[rgba(109,94,252,0.16)] text-[var(--text)]"
                                  : "text-[var(--muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text)]",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">
                                  {section.section_type} {section.order + 1}
                                </span>
                                <span className="text-xs text-[var(--muted2)]">
                                  {Array.isArray(section.chord_progression) &&
                                  section.chord_progression.length
                                    ? `${section.chord_progression.length} chords`
                                    : "no chords"}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                      No sections yet.
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[var(--muted2)]">
                      {activeSection ? (
                        <>
                          Editing {activeSection.section_type} #{activeSection.order + 1}
                        </>
                      ) : (
                        "Select a section"
                      )}
                    </div>
                    {activeSection ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void previewSection()}
                          disabled={previewing}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(255,255,255,0.07)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.10)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Play className="h-4 w-4" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadSectionMp3()}
                          disabled={previewing}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
                          title="Render and download an MP3 (requires server configuration)"
                        >
                          <Download className="h-4 w-4" />
                          MP3
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(selectedSection, -1)}
                          className="inline-flex items-center gap-1 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-2 py-2 text-xs text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                          aria-label="Move section up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(selectedSection, 1)}
                          className="inline-flex items-center gap-1 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-2 py-2 text-xs text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                          aria-label="Move section down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSection(selectedSection)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,62,165,0.12)]"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {previewStatus ? (
                    <div className="text-xs text-[var(--muted2)]">{previewStatus}</div>
                  ) : null}

                  {activeSection ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-[var(--muted2)]">Section type</span>
                          <input
                            value={activeSection.section_type ?? ""}
                            onChange={(e) =>
                              updateSectionField("section_type", e.target.value.trim() || "verse")
                            }
                            className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                            placeholder="verse"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-[var(--muted2)]">Chord progression</span>
                          <input
                            value={stringifyChordProgression(activeSection.chord_progression)}
                            onChange={(e) =>
                              updateSectionField(
                                "chord_progression",
                                parseChordProgression(e.target.value),
                              )
                            }
                            className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                            placeholder="C Am F G"
                          />
                        </label>
                      </div>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted2)]">Lyrics draft</span>
                        <textarea
                          value={activeSection.lyrics ?? ""}
                          onChange={(e) => updateSectionField("lyrics", e.target.value)}
                          rows={10}
                          className="min-h-[240px] w-full resize-y rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                          placeholder="Write lyrics for this section…"
                        />
                      </label>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 text-sm text-[var(--muted)]">
                      Select a section to edit lyrics + chords.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Album</div>
          <div className="mt-2 grid grid-cols-1 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted2)]">Title</span>
              <input
                value={album.title ?? ""}
                onChange={(e) => {
                  setAlbum((prev) => ({ ...prev, title: e.target.value }));
                  markDirty();
                }}
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted2)]">Artist</span>
              <input
                value={album.artist ?? ""}
                onChange={(e) => {
                  setAlbum((prev) => ({ ...prev, artist: e.target.value || null }));
                  markDirty();
                }}
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="Artist name"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted2)]">Primary genre</span>
              <input
                value={album.primary_genre ?? ""}
                onChange={(e) => {
                  setAlbum((prev) => ({ ...prev, primary_genre: e.target.value || null }));
                  markDirty();
                }}
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="Alt pop"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted2)]">Concept summary</span>
              <textarea
                value={album.concept_summary ?? ""}
                onChange={(e) => {
                  setAlbum((prev) => ({ ...prev, concept_summary: e.target.value || null }));
                  markDirty();
                }}
                rows={5}
                className="w-full resize-y rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="One paragraph describing the album concept…"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted2)]">Central themes</span>
              <input
                value={centralThemesText}
                onChange={(e) => {
                  setCentralThemesText(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="identity, memory, change"
              />
              <div className="text-xs text-[var(--muted2)]">
                Comma-separated (used by coherence analyzer).
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-[var(--muted2)]">Save</div>
              <div className="text-sm font-semibold text-[var(--text)]">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </div>
            </div>
            <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--muted)]">
              {saving ? "saving…" : "ready"}
            </div>
          </div>

          <label className="mt-3 flex flex-col gap-1">
            <span className="text-xs text-[var(--muted2)]">Version message (optional)</span>
            <input
              value={versionMessage}
              onChange={(e) => setVersionMessage(e.target.value)}
              className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              placeholder="e.g., tightened chorus + added chords"
            />
          </label>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => save({ withVersion: false })}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button
              type="button"
              onClick={() => save({ withVersion: true })}
              disabled={saving || !versionMessage.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save version
            </button>
          </div>

          {status ? <div className="mt-3 text-xs text-[var(--muted)]">{status}</div> : null}
        </div>

        {activeSong && activeSection ? (
          stableIdsPersisted ? (
            <SectionComments
              albumId={albumId}
              section={{
                id: activeSection.id!,
                songTrackNumber: activeSong.track_number,
                sectionType: activeSection.section_type,
                sectionOrder: activeSection.order,
              }}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[var(--muted2)]">Collaboration</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">Comments</div>
                </div>
                <button
                  type="button"
                  onClick={() => save({ withVersion: false })}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  Save to enable
                </button>
              </div>
              <div className="mt-2 text-xs leading-relaxed text-[var(--muted2)]">
                This project was imported without stable section IDs. Save once to enable comments and
                shareable deep links.
              </div>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Collaboration</div>
            <div className="mt-1 text-sm font-semibold text-[var(--text)]">Comments</div>
            <div className="mt-2 text-xs text-[var(--muted2)]">
              Select a section to leave feedback.
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Tips</div>
          <ul className="mt-2 space-y-2 text-sm text-[var(--muted)]">
            <li>Keep chord loops short (4-8 chords) for clean MIDI exports.</li>
            <li>Use section types like `verse`, `chorus`, `bridge` for better tooling.</li>
            <li>
              Jump here from deep links: `song=track_number&section=order` or
              `song=track_number&sid=section_id`.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function AlbumStudio(props: AlbumStudioProps) {
  return useAlbumStudioRender(props);
}
