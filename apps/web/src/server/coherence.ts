import { AlbumJsonSchema } from "@/server/album-json";

type CoherenceIssueSeverity = "info" | "warning" | "error";

type CoherenceIssue = {
  id: string;
  severity: CoherenceIssueSeverity;
  title: string;
  detail: string;
  suggestion?: string;
};

type CoherenceReport = {
  score: number;
  summary: string;
  stats: {
    songCount: number;
    sectionCount: number;
    songsWithChords: number;
    songsWithLyrics: number;
    songsMissingKeys: number;
    songsMissingTempo: number;
    uniqueKeys: number;
    uniqueTempos: number;
    uniqueThemes: number;
    uniqueMotifs: number;
  };
  issues: CoherenceIssue[];
};

function uniqStrings(values: Array<string | null | undefined>) {
  const set = new Set(
    values
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean)
      .map((v) => v.toLowerCase()),
  );
  return Array.from(set);
}

function detectPlaceholderLyrics(lyrics: string | null | undefined) {
  if (!lyrics) return false;
  const normalized = lyrics.toLowerCase();
  return (
    normalized.includes("[add lyrics") ||
    normalized.includes("[verse line") ||
    normalized.includes("[chorus line")
  );
}

function sortIssues(issues: CoherenceIssue[]) {
  const rank: Record<CoherenceIssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return issues.slice().sort((a, b) => {
    const bySeverity = rank[a.severity] - rank[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.title.localeCompare(b.title);
  });
}

export function analyzeAlbumCoherence(raw: unknown): CoherenceReport {
  const parsed = AlbumJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      score: 0,
      summary: "This project data is not compatible with the Album schema.",
      stats: {
        songCount: 0,
        sectionCount: 0,
        songsWithChords: 0,
        songsWithLyrics: 0,
        songsMissingKeys: 0,
        songsMissingTempo: 0,
        uniqueKeys: 0,
        uniqueTempos: 0,
        uniqueThemes: 0,
        uniqueMotifs: 0,
      },
      issues: [
        {
          id: "invalid_album",
          severity: "error",
          title: "Invalid album payload",
          detail: parsed.error.issues[0]?.message ?? "Album JSON failed validation.",
          suggestion:
            "Re-generate the project JSON from the Create page or re-import from a known-good album.json.",
        },
      ],
    };
  }

  const album = parsed.data;
  const issues: CoherenceIssue[] = [];
  let score = 100;

  const songCount = album.songs.length;
  if (!songCount) {
    issues.push({
      id: "no_songs",
      severity: "error",
      title: "No songs found",
      detail: "This album has 0 songs.",
      suggestion: "Add a tracklist (at least 4 songs) to start shaping the narrative arc.",
    });
    score -= 40;
  }

  if (!album.concept_summary?.trim()) {
    issues.push({
      id: "missing_concept",
      severity: "warning",
      title: "Missing concept summary",
      detail: "Albums feel more cohesive when they have a one-sentence premise.",
      suggestion: "Write a 1-2 sentence logline for the album concept and stakes.",
    });
    score -= 10;
  }

  const seenTrackNumbers = new Set<number>();
  const duplicateTrackNumbers = new Set<number>();
  const titleCounts = new Map<string, number>();
  const keys: Array<string | null | undefined> = [];
  const tempos: Array<number | null | undefined> = [];
  const themes: string[] = [];
  const motifs: string[] = [];

  let sectionCount = 0;
  let songsWithChords = 0;
  let songsWithLyrics = 0;
  let songsMissingKeys = 0;
  let songsMissingTempo = 0;

  for (const song of album.songs) {
    sectionCount += song.sections.length;
    tempos.push(song.tempo ?? null);
    keys.push(song.key ?? null);
    themes.push(...song.themes);
    motifs.push(...song.motifs);

    if (!song.key) songsMissingKeys += 1;
    if (!song.tempo) songsMissingTempo += 1;

    // Track number sanity
    if (seenTrackNumbers.has(song.track_number)) duplicateTrackNumbers.add(song.track_number);
    seenTrackNumbers.add(song.track_number);

    // Duplicate title check (case-insensitive)
    const normalizedTitle = song.title.trim().toLowerCase();
    titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);

    const hasChords = song.sections.some((s) => (s.chord_progression ?? []).length > 0);
    if (hasChords) songsWithChords += 1;
    const hasLyrics = song.sections.some((s) => Boolean(s.lyrics?.trim()) && !detectPlaceholderLyrics(s.lyrics));
    if (hasLyrics) songsWithLyrics += 1;

    if (song.sections.length < 2) {
      issues.push({
        id: `song_${song.track_number}_low_sections`,
        severity: "warning",
        title: `Track ${song.track_number} has minimal structure`,
        detail: `${song.title} has ${song.sections.length} section(s).`,
        suggestion: "Add at least Verse + Chorus (and optionally Bridge) so the hook can repeat.",
      });
      score -= 2;
    }

    if (!hasChords) {
      issues.push({
        id: `song_${song.track_number}_missing_chords`,
        severity: "warning",
        title: `Track ${song.track_number} missing chords`,
        detail: `${song.title} has no chord progressions yet.`,
        suggestion: "Add a 4-8 bar loop per section to make MIDI export and harmonic continuity work.",
      });
      score -= 2;
    }

    if (!hasLyrics) {
      issues.push({
        id: `song_${song.track_number}_missing_lyrics`,
        severity: "info",
        title: `Track ${song.track_number} missing real lyrics`,
        detail: `${song.title} only has placeholders or empty lyrics.`,
        suggestion: "Draft at least one verse and one hook line; then run coherence checks for callbacks.",
      });
      score -= 1;
    }
  }

  if (duplicateTrackNumbers.size) {
    issues.push({
      id: "duplicate_track_numbers",
      severity: "error",
      title: "Duplicate track numbers",
      detail: `Duplicate track numbers: ${Array.from(duplicateTrackNumbers).sort((a, b) => a - b).join(", ")}.`,
      suggestion: "Ensure each song has a unique track_number (1..N).",
    });
    score -= 15;
  }

  const duplicatedTitles = Array.from(titleCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([title]) => title);
  if (duplicatedTitles.length) {
    issues.push({
      id: "duplicate_titles",
      severity: "warning",
      title: "Duplicate song titles",
      detail: `Some titles repeat: ${duplicatedTitles.slice(0, 4).join(", ")}${duplicatedTitles.length > 4 ? "…" : ""}.`,
      suggestion: "Rename duplicates so the tracklist feels intentional and memorable.",
    });
    score -= 5;
  }

  const uniqueKeys = uniqStrings(keys).length;
  const uniqueTempos = new Set(tempos.filter((t): t is number => typeof t === "number")).size;
  const uniqueThemes = uniqStrings([...album.central_themes, ...themes]).length;
  const uniqueMotifs = uniqStrings([...album.recurring_motifs, ...motifs]).length;

  if (songsMissingKeys > Math.ceil(songCount / 2)) {
    issues.push({
      id: "missing_keys",
      severity: "info",
      title: "Many songs missing key",
      detail: `${songsMissingKeys}/${songCount} tracks do not set a key.`,
      suggestion: "Pick 1-2 home keys for the album and write intentional modulations on pivotal tracks.",
    });
    score -= 4;
  }

  if (songsMissingTempo > Math.ceil(songCount / 2)) {
    issues.push({
      id: "missing_tempo",
      severity: "info",
      title: "Many songs missing tempo",
      detail: `${songsMissingTempo}/${songCount} tracks do not set a tempo.`,
      suggestion: "Set tempos so transitions between tracks feel designed (e.g., 96 -> 120 -> 84).",
    });
    score -= 4;
  }

  if (!uniqueThemes) {
    issues.push({
      id: "no_themes",
      severity: "info",
      title: "No themes tracked yet",
      detail: "Themes help enforce lyrical callbacks and narrative cohesion across tracks.",
      suggestion: "Add 3-5 central themes and tag each track with 1-2.",
    });
    score -= 3;
  }

  if (!uniqueMotifs) {
    issues.push({
      id: "no_motifs",
      severity: "info",
      title: "No motifs tracked yet",
      detail: "Motifs (lyrical or musical) make concept albums feel interconnected.",
      suggestion: "Pick 1-3 recurring motifs and reintroduce them at key narrative moments.",
    });
    score -= 3;
  }

  score = Math.max(0, Math.min(100, score));
  const topIssue = sortIssues(issues)[0];
  const summary = topIssue
    ? `${score}/100 coherence score. Top issue: ${topIssue.title}.`
    : `${score}/100 coherence score. Looks clean.`;

  return {
    score,
    summary,
    stats: {
      songCount,
      sectionCount,
      songsWithChords,
      songsWithLyrics,
      songsMissingKeys,
      songsMissingTempo,
      uniqueKeys,
      uniqueTempos,
      uniqueThemes,
      uniqueMotifs,
    },
    issues: sortIssues(issues),
  };
}
