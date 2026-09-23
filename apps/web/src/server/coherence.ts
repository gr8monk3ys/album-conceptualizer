import { AlbumJsonSchema } from "@/server/album-json";

export type CoherenceIssueSeverity = "info" | "warning" | "error";
export type CoherenceDimension = "narrative" | "lyrics" | "harmony" | "sequence" | "motifs";
export type CoherenceActionTarget = "album" | "bible" | "studio";

/**
 * Where an issue is fixed. Every fix lives in the Studio: a track's lyrics and chords
 * (`song`), a track's story notes (themes, motifs, characters, narrative: `story`), the
 * album-level concept, themes and motifs (`album`), or the Style bible (`style`).
 */
export type CoherenceFix = {
  focus: "song" | "story" | "album" | "style";
  trackNumber?: number;
};

/** One piece of material the report still needs before it can give a score. */
export type CoherenceMissingPiece = {
  id: string;
  label: string;
  fix?: CoherenceFix;
};

/** Tracks with written lyrics needed before the report gives a score. */
export const MIN_WRITTEN_TRACKS_FOR_SCORE = 2;

/** The page that fixes an issue, for an album. */
export function coherenceFixHref(albumId: string, fix: CoherenceFix | undefined) {
  const base = `/app/albums/${albumId}`;
  if (!fix) return `${base}/studio`;
  if (fix.focus === "style") return `${base}/style`;
  if (fix.focus === "album") return `${base}/studio?focus=album`;
  const song = typeof fix.trackNumber === "number" ? `song=${fix.trackNumber}` : "";
  if (fix.focus === "story") return `${base}/studio?${song ? `${song}&` : ""}focus=story`;
  return song ? `${base}/studio?${song}` : `${base}/studio`;
}

export type CoherenceIssue = {
  id: string;
  severity: CoherenceIssueSeverity;
  category: CoherenceDimension;
  title: string;
  detail: string;
  suggestion?: string;
  relatedTracks?: number[];
  fix?: CoherenceFix;
};

export type CoherenceBreakdownItem = {
  key: CoherenceDimension;
  label: string;
  score: number;
  summary: string;
};

export type CoherenceNextAction = {
  id: string;
  title: string;
  detail: string;
  target: CoherenceActionTarget;
  category: CoherenceDimension;
  fix?: CoherenceFix;
};

export type CoherenceReport = {
  /**
   * Always computed, but only meaningful when `insufficient` is false: a template scaffold
   * with placeholder lyrics has nothing to judge yet, so pages show `missing` instead.
   */
  score: number;
  summary: string;
  insufficient: boolean;
  missing: CoherenceMissingPiece[];
  stats: {
    songCount: number;
    sectionCount: number;
    songsWithChords: number;
    songsWithLyrics: number;
    songsWithNarrativeSummary: number;
    songsAlignedToThemes: number;
    songsMissingKeys: number;
    songsMissingTempo: number;
    callbackMotifs: number;
    uniqueKeys: number;
    uniqueTempos: number;
    uniqueThemes: number;
    uniqueMotifs: number;
  };
  breakdown: CoherenceBreakdownItem[];
  issues: CoherenceIssue[];
  nextActions: CoherenceNextAction[];
};

type SongSnapshot = {
  trackNumber: number;
  title: string;
  sectionCount: number;
  sectionPattern: string;
  hasChords: boolean;
  scaffoldHarmony: boolean;
  hasLyrics: boolean;
  hasNarrativeSummary: boolean;
  hasChorus: boolean;
  key: string | null;
  tempo: number | null;
  themes: string[];
  motifs: string[];
};

const CATEGORY_LABELS: Record<CoherenceDimension, string> = {
  narrative: "Narrative",
  lyrics: "Lyrics",
  harmony: "Harmony",
  sequence: "Sequence",
  motifs: "Motifs",
};

function uniqStrings(values: Array<string | null | undefined>) {
  const set = new Set(
    values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .map((value) => value.toLowerCase()),
  );
  return Array.from(set);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Lyrics count as written once bracketed placeholders like "[Verse line 1]" are removed. */
export function isWrittenLyrics(lyrics: string | null | undefined) {
  return typeof lyrics === "string" && lyrics.replace(/\[[^\]]*\]/g, "").trim().length > 0;
}

function progressionKey(chords: string[] | undefined) {
  return (chords ?? [])
    .map((chord) => chord.trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function sortIssues(issues: CoherenceIssue[]) {
  const rank: Record<CoherenceIssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return issues.slice().sort((left, right) => {
    const bySeverity = rank[left.severity] - rank[right.severity];
    if (bySeverity !== 0) return bySeverity;
    return left.title.localeCompare(right.title);
  });
}

function ratioPenalty(numerator: number, denominator: number, maxPenalty: number) {
  if (!denominator || numerator <= 0) return 0;
  return Math.round((numerator / denominator) * maxPenalty);
}

function buildBreakdownItem(
  key: CoherenceDimension,
  score: number,
  summary: string,
): CoherenceBreakdownItem {
  return {
    key,
    label: CATEGORY_LABELS[key],
    score: clampScore(score),
    summary,
  };
}

function summarizeBreakdown(breakdown: CoherenceBreakdownItem[]) {
  const weakest = breakdown.reduce((currentWeakest, item) =>
    item.score < currentWeakest.score ? item : currentWeakest,
  );
  return { weakest };
}

function buildNextActions(issues: CoherenceIssue[]): CoherenceNextAction[] {
  const topIssues = sortIssues(issues);
  const actions: CoherenceNextAction[] = [];
  const seenTargets = new Set<string>();

  for (const issue of topIssues) {
    // Fixes live in the Studio; only an issue without a fix points at the Bible to read.
    const target: CoherenceActionTarget = issue.fix
      ? "studio"
      : issue.category === "narrative" || issue.category === "motifs"
        ? "bible"
        : "studio";
    const dedupeKey = `${issue.category}:${target}`;
    if (seenTargets.has(dedupeKey)) continue;

    actions.push({
      id: `action-${issue.id}`,
      title: issue.title,
      detail: issue.suggestion ?? issue.detail,
      target,
      category: issue.category,
      fix: issue.fix,
    });
    seenTargets.add(dedupeKey);

    if (actions.length === 3) break;
  }

  return actions;
}

function getInvalidAlbumReport(detail: string): CoherenceReport {
  const issues: CoherenceIssue[] = [
    {
      id: "invalid_album",
      severity: "error",
      category: "sequence",
      title: "This album could not be read",
      detail,
      suggestion:
        "Save the album again in the Studio, or restore an earlier version from Version history.",
    },
  ];

  const breakdown = [
    buildBreakdownItem("narrative", 0, "The album could not be read."),
    buildBreakdownItem("lyrics", 0, "Lyrics can't be checked until the album can be read."),
    buildBreakdownItem("harmony", 0, "Harmony can't be checked until the album can be read."),
    buildBreakdownItem("sequence", 0, "Track and section ordering cannot be evaluated."),
    buildBreakdownItem("motifs", 0, "Theme and motif coverage cannot be evaluated."),
  ];

  return {
    score: 0,
    summary: "This album could not be read, so there is nothing to score yet.",
    insufficient: true,
    missing: [
      {
        id: "invalid_album",
        label: "Album data that can be read: save the album again in the Studio",
        fix: { focus: "song" },
      },
    ],
    stats: {
      songCount: 0,
      sectionCount: 0,
      songsWithChords: 0,
      songsWithLyrics: 0,
      songsWithNarrativeSummary: 0,
      songsAlignedToThemes: 0,
      songsMissingKeys: 0,
      songsMissingTempo: 0,
      callbackMotifs: 0,
      uniqueKeys: 0,
      uniqueTempos: 0,
      uniqueThemes: 0,
      uniqueMotifs: 0,
    },
    breakdown,
    issues,
    nextActions: buildNextActions(issues),
  };
}

export function analyzeAlbumCoherence(raw: unknown): CoherenceReport {
  const parsed = AlbumJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return getInvalidAlbumReport(
      "Part of this album's data is in a shape the report does not understand.",
    );
  }

  const album = parsed.data;
  const issues: CoherenceIssue[] = [];

  const songCount = album.songs.length;
  if (!songCount) {
    issues.push({
      id: "no_songs",
      severity: "error",
      category: "sequence",
      title: "No songs found",
      detail: "This album has no songs yet.",
      suggestion: "Add a tracklist with at least 4 songs to shape the arc before exporting.",
      fix: { focus: "song" },
    });
  }

  const albumThemes = uniqStrings(album.central_themes);

  const seenTrackNumbers = new Set<number>();
  const duplicateTrackNumbers = new Set<number>();
  const titleCounts = new Map<string, number>();
  const keySet = new Set<string>();
  const tempos: number[] = [];
  const patternCounts = new Map<string, number>();
  const motifCoverage = new Map<string, Set<number>>();

  let sectionCount = 0;
  let songsWithChords = 0;
  let songsWithLyrics = 0;
  let songsWithNarrativeSummary = 0;
  let songsMissingKeys = 0;
  let songsMissingTempo = 0;
  let songsWithoutChorus = 0;
  let placeholderLyricsSongs = 0;
  let minimalStructureSongs = 0;
  let songsAlignedToThemes = 0;

  const snapshots: SongSnapshot[] = album.songs
    .map((song) => {
      const themes = uniqStrings(song.themes);
      const motifs = uniqStrings(song.motifs);
      const hasLyrics = song.sections.some((section) => isWrittenLyrics(section.lyrics));
      // The template copies one loop onto every section. With no lyrics written, that loop is
      // scaffolding, not a harmonic decision, so it earns no harmony credit.
      const chordedSections = song.sections.filter((section) => progressionKey(section.chord_progression));
      const scaffoldHarmony =
        chordedSections.length > 0 &&
        !hasLyrics &&
        new Set(chordedSections.map((section) => progressionKey(section.chord_progression))).size === 1;
      const hasChords = chordedSections.length > 0 && !scaffoldHarmony;
      const hasNarrativeSummary = Boolean(song.narrative_summary?.trim());
      const hasChorus = song.sections.some(
        (section) => section.section_type.trim().toLowerCase() === "chorus",
      );
      const key = typeof song.key === "string" && song.key.trim() ? song.key.trim() : null;
      const tempo = typeof song.tempo === "number" ? song.tempo : null;
      const sectionPattern = song.sections
        .map((section) => section.section_type.trim().toLowerCase())
        .join(" > ");

      sectionCount += song.sections.length;
      if (hasChords) songsWithChords += 1;
      if (hasLyrics) songsWithLyrics += 1;
      if (hasNarrativeSummary) songsWithNarrativeSummary += 1;
      if (!hasChorus) songsWithoutChorus += 1;
      if (!key) songsMissingKeys += 1;
      if (!tempo) songsMissingTempo += 1;
      if (key) keySet.add(key.toLowerCase());
      if (tempo) tempos.push(tempo);
      if (song.sections.length < 2) minimalStructureSongs += 1;

      if (
        song.sections.some((section) => Boolean(section.lyrics?.trim())) &&
        !hasLyrics
      ) {
        placeholderLyricsSongs += 1;
      }

      if (seenTrackNumbers.has(song.track_number)) duplicateTrackNumbers.add(song.track_number);
      seenTrackNumbers.add(song.track_number);

      const normalizedTitle = song.title.trim().toLowerCase();
      titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);
      if (sectionPattern) {
        patternCounts.set(sectionPattern, (patternCounts.get(sectionPattern) ?? 0) + 1);
      }

      const alignedToThemes = albumThemes.length
        ? themes.some((theme) => albumThemes.includes(theme))
        : themes.length > 0;
      if (alignedToThemes) songsAlignedToThemes += 1;

      for (const motif of motifs) {
        if (!motifCoverage.has(motif)) motifCoverage.set(motif, new Set<number>());
        motifCoverage.get(motif)?.add(song.track_number);
      }

      return {
        trackNumber: song.track_number,
        title: song.title,
        sectionCount: song.sections.length,
        sectionPattern,
        hasChords,
        scaffoldHarmony,
        hasLyrics,
        hasNarrativeSummary,
        hasChorus,
        key,
        tempo,
        themes,
        motifs,
      } satisfies SongSnapshot;
    })
    .sort((left, right) => left.trackNumber - right.trackNumber);

  const uniqueKeys = keySet.size;
  const uniqueTempos = new Set(tempos).size;
  const uniqueThemes = uniqStrings([
    ...album.central_themes,
    ...snapshots.flatMap((song) => song.themes),
  ]).length;
  const uniqueMotifs = uniqStrings([
    ...album.recurring_motifs,
    ...snapshots.flatMap((song) => song.motifs),
  ]).length;
  const callbackMotifs = Array.from(motifCoverage.values()).filter((tracks) => tracks.size >= 2).length;

  const dominantPatternCount = Math.max(0, ...patternCounts.values());
  const tempoSpread =
    tempos.length > 1 ? Math.max(...tempos) - Math.min(...tempos) : 0;
  const repeatedEnergyProfile =
    songCount >= 4 &&
    dominantPatternCount >= Math.ceil(songCount * 0.75) &&
    (uniqueTempos <= 2 || tempoSpread <= 10);

  const themeDriftTracks = snapshots
    .filter((song) => albumThemes.length > 0 && song.themes.length > 0)
    .filter((song) => !song.themes.some((theme) => albumThemes.includes(theme)))
    .map((song) => song.trackNumber);

  const opener = snapshots[0] ?? null;
  const closer = snapshots[snapshots.length - 1] ?? null;
  const openerSignals = opener
    ? opener.themes.length + opener.motifs.length + (opener.hasNarrativeSummary ? 1 : 0)
    : 0;
  const closerSignals = closer
    ? closer.themes.length + closer.motifs.length + (closer.hasNarrativeSummary ? 1 : 0)
    : 0;
  const openerCloserOverlap =
    opener && closer
      ? uniqStrings([...opener.themes, ...opener.motifs]).filter((value) =>
          uniqStrings([...closer.themes, ...closer.motifs]).includes(value),
        ).length
      : 0;
  const weakBookends =
    songCount >= 4 &&
    ((!opener || !closer) ||
      openerSignals === 0 ||
      closerSignals === 0 ||
      openerCloserOverlap === 0);

  const songsMissingLyrics = songCount - songsWithLyrics;
  const songsMissingChords = songCount - songsWithChords;
  const scaffoldHarmonySongs = snapshots.filter((song) => song.scaffoldHarmony).length;
  const firstTrack = (predicate: (song: SongSnapshot) => boolean) =>
    snapshots.find(predicate)?.trackNumber;

  if (!album.concept_summary?.trim()) {
    issues.push({
      id: "missing_concept",
      severity: "warning",
      category: "narrative",
      title: "Missing concept summary",
      detail: "Albums feel more coherent when the project has a one-sentence premise and stakes.",
      suggestion: "Write a one- or two-sentence logline in the album's story notes.",
      fix: { focus: "album" },
    });
  }

  if (duplicateTrackNumbers.size) {
    issues.push({
      id: "duplicate_track_numbers",
      severity: "error",
      category: "sequence",
      title: "Duplicate track numbers",
      detail: `Duplicate track numbers: ${Array.from(duplicateTrackNumbers)
        .sort((left, right) => left - right)
        .join(", ")}.`,
      suggestion: "Give each song its own track number before sequencing the album.",
      relatedTracks: Array.from(duplicateTrackNumbers).sort((left, right) => left - right),
      fix: { focus: "song", trackNumber: Math.min(...duplicateTrackNumbers) },
    });
  }

  const duplicatedTitles = Array.from(titleCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([title]) => title);
  if (duplicatedTitles.length) {
    issues.push({
      id: "duplicate_titles",
      severity: "warning",
      category: "sequence",
      title: "Duplicate song titles",
      detail: `Some titles repeat: ${duplicatedTitles.slice(0, 4).join(", ")}${duplicatedTitles.length > 4 ? "…" : ""}.`,
      suggestion: "Rename duplicates so the tracklist feels intentional and memorable.",
      fix: { focus: "song" },
    });
  }

  if (minimalStructureSongs > 0) {
    issues.push({
      id: "minimal_structure",
      severity: minimalStructureSongs > Math.ceil(songCount / 2) ? "warning" : "info",
      category: "sequence",
      title: "Several tracks still have minimal structure",
      detail: `${minimalStructureSongs}/${songCount} tracks have fewer than 2 sections.`,
      suggestion: "Add at least Verse + Chorus to the weakest songs before doing another export pass.",
      relatedTracks: snapshots
        .filter((song) => song.sectionCount < 2)
        .map((song) => song.trackNumber),
      fix: { focus: "song", trackNumber: firstTrack((song) => song.sectionCount < 2) },
    });
  }

  if (songsMissingChords > 0) {
    issues.push({
      id: "missing_chords",
      severity: songsMissingChords > Math.ceil(songCount / 2) ? "warning" : "info",
      category: "harmony",
      title: "Chord coverage is still thin",
      detail: `${songsMissingChords}/${songCount} tracks do not have usable chord progressions yet.${
        scaffoldHarmonySongs
          ? ` The starting loop copied onto ${scaffoldHarmonySongs} unwritten track(s) doesn't count until lyrics are written or the chords change.`
          : ""
      }`,
      suggestion: "Fill in 4-8 bar loops on the weakest songs so the harmonic arc can be assessed.",
      relatedTracks: snapshots.filter((song) => !song.hasChords).map((song) => song.trackNumber),
      fix: { focus: "song", trackNumber: firstTrack((song) => !song.hasChords) },
    });
  }

  if (songsMissingLyrics > 0) {
    issues.push({
      id: "missing_lyrics",
      severity: songsMissingLyrics > Math.ceil(songCount / 2) ? "warning" : "info",
      category: "lyrics",
      title: "Several tracks are still lyric-light",
      detail: `${songsMissingLyrics}/${songCount} tracks still have placeholders or empty lyrics.`,
      suggestion: "Draft at least one verse and one hook on the weakest tracks so callbacks can emerge.",
      relatedTracks: snapshots.filter((song) => !song.hasLyrics).map((song) => song.trackNumber),
      fix: { focus: "song", trackNumber: firstTrack((song) => !song.hasLyrics) },
    });
  }

  if (placeholderLyricsSongs > 0) {
    issues.push({
      id: "placeholder_lyrics",
      severity: "info",
      category: "lyrics",
      title: "Placeholder lyrics are still carrying too much of the project",
      detail: `${placeholderLyricsSongs} track(s) only have template lyric text so far.`,
      suggestion: "Replace placeholders on the songs most likely to become singles or anchor moments.",
      fix: { focus: "song", trackNumber: firstTrack((song) => !song.hasLyrics) },
    });
  }

  if (songsMissingKeys + songsMissingTempo > 0) {
    const missingMetaTracks = snapshots
      .filter((song) => !song.key || !song.tempo)
      .map((song) => song.trackNumber);
    issues.push({
      id: "missing_key_tempo",
      severity:
        songsMissingKeys > Math.ceil(songCount / 2) || songsMissingTempo > Math.ceil(songCount / 2)
          ? "warning"
          : "info",
      category: "harmony",
      title: "Too many songs are missing tempo or key",
      detail: `${songsMissingKeys}/${songCount} tracks lack a key and ${songsMissingTempo}/${songCount} lack a tempo.`,
      suggestion: "Set a home key and rough tempo map so transitions between songs feel designed.",
      relatedTracks: missingMetaTracks,
      fix: { focus: "song", trackNumber: missingMetaTracks[0] },
    });
  }

  if (!uniqueThemes) {
    issues.push({
      id: "no_themes",
      severity: "info",
      category: "narrative",
      title: "No album themes are tracked yet",
      detail: "Themes are still empty, so the app cannot judge whether songs are pulling in the same direction.",
      suggestion: "Add 3-5 central themes and tag each track with 1-2 of them.",
      fix: { focus: "album" },
    });
  }

  const songsMissingNarrative = snapshots.filter((song) => !song.hasNarrativeSummary);
  if (songCount > 0 && songsMissingNarrative.length > 0) {
    issues.push({
      id: "missing_narrative_summaries",
      severity: songsMissingNarrative.length > Math.ceil(songCount / 2) ? "warning" : "info",
      category: "narrative",
      title: "Tracks without a story note",
      detail: `${songsMissingNarrative.length}/${songCount} tracks have no narrative summary, so their place in the arc can't be checked.`,
      suggestion: "Write one or two sentences on what happens in each track.",
      relatedTracks: songsMissingNarrative.map((song) => song.trackNumber),
      fix: { focus: "story", trackNumber: songsMissingNarrative[0]?.trackNumber },
    });
  }

  if (albumThemes.length > 0 && songsAlignedToThemes < Math.ceil(songCount / 2)) {
    issues.push({
      id: "theme_drift",
      severity: "warning",
      category: "narrative",
      title: "Theme drift is starting to show",
      detail: `Only ${songsAlignedToThemes}/${songCount} tracks align to the album's declared themes.`,
      suggestion: "Retag songs that belong, then rewrite outliers so the arc feels intentional.",
      relatedTracks: themeDriftTracks,
      fix: {
        focus: "story",
        trackNumber:
          themeDriftTracks[0] ??
          firstTrack((song) => !song.themes.some((theme) => albumThemes.includes(theme))),
      },
    });
  }

  if (!uniqueMotifs) {
    issues.push({
      id: "no_motifs",
      severity: "info",
      category: "motifs",
      title: "No recurring motifs are tracked yet",
      detail: "Motifs are what make concept albums feel intentionally interconnected.",
      suggestion: "Pick 1-3 recurring lyrical or sonic motifs and plant them on multiple songs.",
      fix: { focus: "album" },
    });
  } else if (callbackMotifs === 0) {
    issues.push({
      id: "missing_callbacks",
      severity: "warning",
      category: "motifs",
      title: "Motifs are not coming back yet",
      detail: "The project has motif tags, but none of them currently recur across multiple tracks.",
      suggestion: "Reintroduce at least one motif on the opener, midpoint, and closer so callbacks land.",
      fix: { focus: "album" },
    });
  }

  if (songsWithoutChorus > Math.ceil(songCount / 2)) {
    issues.push({
      id: "weak_hooks",
      severity: "info",
      category: "lyrics",
      title: "Hook structure is still under-defined",
      detail: `${songsWithoutChorus}/${songCount} tracks do not have a chorus section yet.`,
      suggestion: "Add chorus sections where appropriate so the album has memorable anchors.",
      relatedTracks: snapshots.filter((song) => !song.hasChorus).map((song) => song.trackNumber),
      fix: { focus: "song", trackNumber: firstTrack((song) => !song.hasChorus) },
    });
  }

  if (repeatedEnergyProfile) {
    issues.push({
      id: "repeated_energy_profile",
      severity: "warning",
      category: "sequence",
      title: "The album's section energy repeats too often",
      detail: `Most songs share the same section pattern and the tempo spread is only ${tempoSpread} BPM.`,
      suggestion: "Vary tempo, section order, or track pacing so the middle of the record does not flatten out.",
      fix: { focus: "song" },
    });
  }

  if (weakBookends) {
    issues.push({
      id: "weak_bookends",
      severity: "warning",
      category: "sequence",
      title: "The opener and closer do not frame the record strongly yet",
      detail: "The first and last tracks are not sharing enough narrative or motif signals to feel like intentional bookends.",
      suggestion: "In the opener's and closer's story notes, give them a shared callback, motif, or narrative echo.",
      relatedTracks: [opener?.trackNumber, closer?.trackNumber].filter(
        (trackNumber): trackNumber is number => typeof trackNumber === "number",
      ),
      fix: { focus: "story", trackNumber: opener?.trackNumber },
    });
  }

  const sortedIssues = sortIssues(issues);

  let narrativeScore = 100;
  if (!songCount) narrativeScore -= 60;
  if (!album.concept_summary?.trim()) narrativeScore -= 18;
  if (!uniqueThemes) narrativeScore -= 12;
  narrativeScore -= ratioPenalty(songCount - songsWithNarrativeSummary, songCount, 18);
  if (albumThemes.length > 0 && songsAlignedToThemes < Math.ceil(songCount / 2)) {
    narrativeScore -= 18;
  }
  if (weakBookends) narrativeScore -= 12;

  let lyricsScore = 100;
  lyricsScore -= ratioPenalty(songsMissingLyrics, songCount, 45);
  lyricsScore -= ratioPenalty(placeholderLyricsSongs, songCount, 16);
  lyricsScore -= ratioPenalty(songsWithoutChorus, songCount, 18);

  let harmonyScore = 100;
  harmonyScore -= ratioPenalty(songsMissingChords, songCount, 45);
  harmonyScore -= ratioPenalty(songsMissingKeys, songCount, 18);
  harmonyScore -= ratioPenalty(songsMissingTempo, songCount, 14);
  if (songCount >= 4 && uniqueKeys <= 1 && songsMissingKeys === 0) harmonyScore -= 8;

  let sequenceScore = 100;
  if (!songCount) sequenceScore -= 50;
  if (duplicateTrackNumbers.size) sequenceScore -= 35;
  sequenceScore -= ratioPenalty(minimalStructureSongs, songCount, 28);
  if (repeatedEnergyProfile) sequenceScore -= 18;
  if (weakBookends) sequenceScore -= 10;
  if (songCount > 0 && songCount < 4) sequenceScore -= 12;

  let motifsScore = 100;
  if (!uniqueThemes) motifsScore -= 16;
  if (!uniqueMotifs) motifsScore -= 18;
  if (albumThemes.length > 0 && songsAlignedToThemes < Math.ceil(songCount / 2)) motifsScore -= 18;
  if (uniqueMotifs > 0 && callbackMotifs === 0) motifsScore -= 22;
  if (uniqueMotifs > 0 && callbackMotifs === 1) motifsScore -= 8;

  const breakdown = [
    buildBreakdownItem(
      "narrative",
      narrativeScore,
      !album.concept_summary?.trim()
        ? "Concept and track-level story cues still need definition."
        : weakBookends
          ? "The arc exists, but the opener and closer are not framing it strongly yet."
          : "Narrative signals are mostly present across the record.",
    ),
    buildBreakdownItem(
      "lyrics",
      lyricsScore,
      songsMissingLyrics
        ? "Lyrics still need to replace placeholders on the weakest tracks."
        : "Lyrics are present enough to start judging callbacks and hooks.",
    ),
    buildBreakdownItem(
      "harmony",
      harmonyScore,
      songsMissingChords || songsMissingKeys || songsMissingTempo
        ? "Key, tempo, and chord coverage still need tightening."
        : "Harmony metadata is strong enough for export and sequencing decisions.",
    ),
    buildBreakdownItem(
      "sequence",
      sequenceScore,
      repeatedEnergyProfile
        ? "Tempo and section energy need more contrast across the record."
        : "Track order and internal song structure are mostly holding together.",
    ),
    buildBreakdownItem(
      "motifs",
      motifsScore,
      callbackMotifs
        ? "At least one motif is recurring across the album."
        : "Motifs and callbacks need to recur on multiple songs to make the record feel connected.",
    ),
  ];

  const weightedScore =
    breakdown[0].score * 0.28 +
    breakdown[1].score * 0.2 +
    breakdown[2].score * 0.18 +
    breakdown[3].score * 0.18 +
    breakdown[4].score * 0.16;
  const score = clampScore(weightedScore);
  const { weakest } = summarizeBreakdown(breakdown);
  const topIssue = sortedIssues[0];

  // A score needs lyrics to judge. A one-track album needs only its one track written.
  const requiredWrittenTracks = Math.max(1, Math.min(MIN_WRITTEN_TRACKS_FOR_SCORE, songCount));
  const insufficient = songsWithLyrics < requiredWrittenTracks;
  const missing: CoherenceMissingPiece[] = [];
  if (insufficient) {
    if (!songCount) {
      missing.push({ id: "tracks", label: "A tracklist: add the first songs", fix: { focus: "song" } });
    } else {
      const needed = requiredWrittenTracks - songsWithLyrics;
      missing.push({
        id: "lyrics",
        label: `Lyrics on ${needed === 1 ? "one more track" : `${needed} more tracks`} (${songsWithLyrics} of ${requiredWrittenTracks} written)`,
        fix: { focus: "song", trackNumber: firstTrack((song) => !song.hasLyrics) },
      });
    }
    if (!album.concept_summary?.trim()) {
      missing.push({ id: "concept", label: "A concept summary for the album", fix: { focus: "album" } });
    }
    if (songCount && !snapshots.some((song) => song.themes.length > 0)) {
      missing.push({
        id: "themes",
        label: "Themes tagged on at least one track",
        fix: { focus: "story", trackNumber: snapshots[0]?.trackNumber },
      });
    }
    if (songCount && !songsWithNarrativeSummary) {
      missing.push({
        id: "narrative",
        label: "A story note on at least one track",
        fix: { focus: "story", trackNumber: snapshots[0]?.trackNumber },
      });
    }
  }

  const summary = insufficient
    ? requiredWrittenTracks === 1
      ? "Not enough material yet — write lyrics for this track to get a score."
      : "Not enough material yet — write lyrics for two tracks to get a score."
    : topIssue
      ? `${score}/100 overall. Weakest area: ${weakest.label} (${weakest.score}/100). Top issue: ${topIssue.title}.`
      : `${score}/100 overall. The album is structurally coherent across the current draft.`;

  return {
    score,
    summary,
    insufficient,
    missing,
    stats: {
      songCount,
      sectionCount,
      songsWithChords,
      songsWithLyrics,
      songsWithNarrativeSummary,
      songsAlignedToThemes,
      songsMissingKeys,
      songsMissingTempo,
      callbackMotifs,
      uniqueKeys,
      uniqueTempos,
      uniqueThemes,
      uniqueMotifs,
    },
    breakdown,
    issues: sortedIssues,
    nextActions: buildNextActions(sortedIssues),
  };
}
