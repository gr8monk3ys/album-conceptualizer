import { trackHasWrittenHarmony } from "@/lib/chords";
import { isWrittenLyrics } from "@/lib/lyrics";
import { albumMotifIndex } from "@/lib/motifs";
import { AlbumJsonSchema } from "@/server/album-json";

export type CoherenceIssueSeverity = "info" | "warning" | "error";
export type CoherenceDimension = "narrative" | "lyrics" | "harmony" | "sequence" | "motifs";
export type CoherenceActionTarget = "album" | "bible" | "studio";

/** Where a single track's issue is fixed in the Studio (the ROUND3 Studio focus values). */
export type CoherenceTrackFocus = "song" | "lyrics" | "story" | "role" | "song-themes" | "motifs";

/**
 * Where an issue is fixed. Every fix lives in the Studio: a track itself (`song`), the first
 * unwritten lyrics (`lyrics`), its Story note (`story`), its Role (`role`), its theme tags
 * (`song-themes`) or motif tags (`motifs`); the album details (`album`) or the album's motifs
 * (`album-motifs`); or the Style bible (`style`).
 */
export type CoherenceFix = {
  focus: CoherenceTrackFocus | "album" | "album-motifs" | "style";
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
  if (fix.focus === "album" || fix.focus === "album-motifs") return `${base}/studio?focus=${fix.focus}`;
  const song = typeof fix.trackNumber === "number" ? `song=${fix.trackNumber}` : "";
  if (fix.focus !== "song") return `${base}/studio?${song ? `${song}&` : ""}focus=${fix.focus}`;
  return song ? `${base}/studio?${song}` : `${base}/studio`;
}

/** The Studio link for one of the tracks a finding names or suggests. */
export function coherenceTrackHref(albumId: string, issue: CoherenceIssue, trackNumber: number) {
  return coherenceFixHref(albumId, { focus: issue.trackFocus ?? "song", trackNumber });
}

/** "1", "1 and 4", "1, 4 and 7": track numbers in order, for a sentence. */
export function formatTrackList(trackNumbers: number[]) {
  const sorted = Array.from(new Set(trackNumbers)).sort((left, right) => left - right);
  if (sorted.length <= 1) return sorted.join("");
  return `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

export type CoherenceIssue = {
  id: string;
  severity: CoherenceIssueSeverity;
  category: CoherenceDimension;
  title: string;
  detail: string;
  suggestion?: string;
  /** The tracks with the problem, in order. */
  relatedTracks?: number[];
  /**
   * Tracks where a fix would land best (not tracks with a problem): "Try it on tracks 1, 4
   * and 7". Kept apart from `relatedTracks` so pages can say which kind of list it is.
   */
  suggestedTracks?: number[];
  /** Where each of `relatedTracks` / `suggestedTracks` is fixed; plain track editing when absent. */
  trackFocus?: CoherenceTrackFocus;
  fix?: CoherenceFix;
};

export type CoherenceBreakdownItem = {
  key: CoherenceDimension;
  label: string;
  /** The score the report gives, after the cap (see `CoherenceReport.scoreCap`). */
  score: number;
  /** What the dimension sees across the whole album, in one or two sentences. */
  summary: string;
  /**
   * The dimension's own score before any cap, measured on the written tracks only (the whole
   * album once every track is written). While the cap holds every dimension at the same
   * number, this is what tells them apart: pages order by it, weakest first.
   */
  uncapped: number;
  /** Why the cap holds `score` below `uncapped` ("only 3 of 8 tracks are written"); absent when it doesn't. */
  heldBecause?: string;
  /** The dimension's own evidence on the tracks it measured: "3 of 3 written tracks have chords of their own". */
  signal: string;
};

export type CoherenceNextAction = {
  id: string;
  title: string;
  detail: string;
  target: CoherenceActionTarget;
  category: CoherenceDimension;
  fix?: CoherenceFix;
};

/** The one-word status of the album, shared by every page that shows a score. */
export type CoherenceVerdict = {
  label: "Not scored yet" | "Unfinished" | "Tight" | "Solid" | "Needs polish" | "Loose";
  /** The count behind the label, when it has one: "3 of 7 tracks written". */
  detail?: string;
  tone: "ok" | "neutral" | "warn" | "danger";
};

/** Score bands, lowest score for each label. Used only once every track has lyrics. */
export const COHERENCE_BANDS = [
  { min: 85, label: "Tight", tone: "ok" },
  { min: 70, label: "Solid", tone: "neutral" },
  { min: 50, label: "Needs polish", tone: "warn" },
  { min: 0, label: "Loose", tone: "danger" },
] as const satisfies ReadonlyArray<{ min: number; label: CoherenceVerdict["label"]; tone: CoherenceVerdict["tone"] }>;

export type CoherenceReport = {
  /**
   * Always computed, but only meaningful when `insufficient` is false: a template scaffold
   * with placeholder lyrics has nothing to judge yet, so pages show `missing` instead.
   */
  score: number;
  summary: string;
  insufficient: boolean;
  missing: CoherenceMissingPiece[];
  /**
   * The album's status. "Unfinished" whenever any track has no lyrics, whatever the score, so
   * a half-written album is never called "Needs polish".
   */
  verdict: CoherenceVerdict;
  /**
   * The highest any dimension may score: the share of tracks with written lyrics, out of 100.
   * Harmony is also capped by the share of tracks with chords of their own.
   */
  scoreCap: number;
  stats: {
    songCount: number;
    sectionCount: number;
    /** Tracks with chords of their own: not empty and not only the starter loop. */
    songsWithChords: number;
    /** Tracks whose chords are still only the starter loop (see `@/lib/chords`). */
    songsWithStarterChords: number;
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
  starterHarmony: boolean;
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
export { isWrittenLyrics };

/** The album's status from its lyric coverage and score. See `CoherenceReport.verdict`. */
export function coherenceVerdict(input: {
  insufficient: boolean;
  score: number;
  songCount: number;
  songsWithLyrics: number;
}): CoherenceVerdict {
  if (input.insufficient) return { label: "Not scored yet", tone: "neutral" };
  if (input.songsWithLyrics < input.songCount) {
    return {
      label: "Unfinished",
      detail: `${input.songsWithLyrics} of ${input.songCount} tracks written`,
      tone: "warn",
    };
  }
  const band = COHERENCE_BANDS.find((entry) => input.score >= entry.min) ?? COHERENCE_BANDS[3];
  return { label: band.label, tone: band.tone };
}

/** "Unfinished · 3 of 7 tracks written", "Solid": the verdict as one line. */
export function verdictText(verdict: CoherenceVerdict) {
  return verdict.detail ? `${verdict.label} · ${verdict.detail}` : verdict.label;
}

/** "3 of 6 tracks", "All 6 tracks", "The track": the subject of a sentence about tracks. */
function tracksThat(count: number, total: number, one: string, many: string) {
  if (total === 1) return `The track ${one}`;
  if (count === total) return `${total === 2 ? "Both tracks" : `All ${total} tracks`} ${many}`;
  return `${count} of ${total} tracks ${count === 1 ? one : many}`;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Tracks without lyrics always lead: nothing else about an album matters as much. */
const PINNED_FIRST = "missing_lyrics";

function isEmptyProgression(chords: string[] | undefined) {
  return !(chords ?? []).some((chord) => chord.trim());
}

function sortIssues(issues: CoherenceIssue[]) {
  const rank: Record<CoherenceIssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  const order = (issue: CoherenceIssue) => (issue.id === PINNED_FIRST ? -1 : rank[issue.severity]);
  return issues.slice().sort((left, right) => {
    const bySeverity = order(left) - order(right);
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
  extra: { uncapped?: number; heldBecause?: string; signal?: string } = {},
): CoherenceBreakdownItem {
  const limited = clampScore(score);
  return {
    key,
    label: CATEGORY_LABELS[key],
    score: limited,
    summary,
    uncapped: clampScore(extra.uncapped ?? score),
    ...(extra.heldBecause ? { heldBecause: extra.heldBecause } : {}),
    signal: extra.signal ?? summary,
  };
}

const DIMENSION_ORDER: CoherenceDimension[] = ["narrative", "lyrics", "harmony", "sequence", "motifs"];

/**
 * The dimensions weakest first, by their own (uncapped) score, so the weak spot reads first
 * even while the cap holds every score at the same number. Ties keep the report's order.
 */
export function dimensionsWeakestFirst(breakdown: CoherenceBreakdownItem[]) {
  return breakdown
    .slice()
    .sort(
      (left, right) =>
        left.uncapped - right.uncapped || DIMENSION_ORDER.indexOf(left.key) - DIMENSION_ORDER.indexOf(right.key),
    );
}

/** The weakest dimension by its own score (see `dimensionsWeakestFirst`). */
export function weakestDimension(report: Pick<CoherenceReport, "breakdown">) {
  return dimensionsWeakestFirst(report.breakdown)[0];
}

/** Track-level counts a dimension score is measured on: every track, or only the written ones. */
type TrackCounts = {
  tracks: number;
  withStory: number;
  onAlbumTheme: number;
  missingLyrics: number;
  withoutChorus: number;
  missingChords: number;
  missingKeys: number;
  missingTempo: number;
  missingKeyOrTempo: number;
  minimalStructure: number;
};

function countTracks(songs: SongSnapshot[], albumThemes: string[]): TrackCounts {
  const count = (predicate: (song: SongSnapshot) => boolean) => songs.filter(predicate).length;
  return {
    tracks: songs.length,
    withStory: count((song) => song.hasNarrativeSummary),
    onAlbumTheme: count((song) =>
      albumThemes.length ? song.themes.some((theme) => albumThemes.includes(theme)) : song.themes.length > 0,
    ),
    missingLyrics: count((song) => !song.hasLyrics),
    withoutChorus: count((song) => !song.hasChorus),
    missingChords: count((song) => !song.hasChords),
    missingKeys: count((song) => !song.key),
    missingTempo: count((song) => !song.tempo),
    missingKeyOrTempo: count((song) => !song.key || !song.tempo),
    minimalStructure: count((song) => song.sectionCount < 2),
  };
}

/** What holds across the whole album, whichever tracks a score is measured on. */
type AlbumFacts = {
  songCount: number;
  hasConcept: boolean;
  albumThemeCount: number;
  uniqueThemes: number;
  uniqueMotifs: number;
  callbackMotifs: number;
  weakBookends: boolean;
  duplicateTrackNumbers: boolean;
  repeatedEnergyProfile: boolean;
  /** Every track has a key and they are all the same one. */
  singleKey: boolean;
};

/** The five dimension scores before any cap, measured on `counts`. */
function dimensionScores(counts: TrackCounts, album: AlbumFacts): Record<CoherenceDimension, number> {
  const total = counts.tracks;
  const themeDrift = album.albumThemeCount > 0 && counts.onAlbumTheme < Math.ceil(total / 2);

  let narrative = 100;
  if (!album.songCount) narrative -= 60;
  if (!album.hasConcept) narrative -= 18;
  if (!album.uniqueThemes) narrative -= 12;
  narrative -= ratioPenalty(total - counts.withStory, total, 18);
  if (themeDrift) narrative -= 18;
  if (album.weakBookends) narrative -= 12;

  let lyrics = 100;
  lyrics -= ratioPenalty(counts.missingLyrics, total, 45);
  lyrics -= ratioPenalty(counts.withoutChorus, total, 18);

  let harmony = 100;
  harmony -= ratioPenalty(counts.missingChords, total, 45);
  harmony -= ratioPenalty(counts.missingKeys, total, 18);
  harmony -= ratioPenalty(counts.missingTempo, total, 14);
  if (album.singleKey) harmony -= 8;

  let sequence = 100;
  if (!album.songCount) sequence -= 50;
  if (album.duplicateTrackNumbers) sequence -= 35;
  sequence -= ratioPenalty(counts.minimalStructure, total, 28);
  if (album.repeatedEnergyProfile) sequence -= 18;
  if (album.weakBookends) sequence -= 10;
  if (album.songCount > 0 && album.songCount < 4) sequence -= 12;

  let motifs = 100;
  if (!album.uniqueThemes) motifs -= 16;
  if (!album.uniqueMotifs) motifs -= 18;
  if (themeDrift) motifs -= 18;
  if (album.uniqueMotifs > 0 && album.callbackMotifs === 0) motifs -= 22;
  if (album.uniqueMotifs > 0 && album.callbackMotifs === 1) motifs -= 8;

  return {
    narrative: clampScore(narrative),
    lyrics: clampScore(lyrics),
    harmony: clampScore(harmony),
    sequence: clampScore(sequence),
    motifs: clampScore(motifs),
  };
}

/**
 * Each dimension's own evidence, on the tracks it was measured on: "3 of 3 written tracks have
 * chords of their own". `scope` is "written track" while some tracks are unwritten.
 */
function dimensionSignals(
  counts: TrackCounts,
  album: AlbumFacts,
  scope: "track" | "written track",
): Record<CoherenceDimension, string> {
  const total = counts.tracks;
  const of = (count: number, one: string, many: string) =>
    `${count} of ${total} ${scope}${total === 1 ? "" : "s"} ${total === 1 ? one : many}`;
  const keyOrTempo = counts.missingKeyOrTempo
    ? `; ${counts.missingKeyOrTempo} ${counts.missingKeyOrTempo === 1 ? "has" : "have"} no key or tempo`
    : "";

  return {
    narrative: `${album.hasConcept ? "" : "No concept summary yet; "}${of(counts.withStory, "has a story note", "have a story note")}`,
    lyrics: of(total - counts.withoutChorus, "has a chorus", "have a chorus"),
    harmony: `${of(total - counts.missingChords, "has chords of its own", "have chords of their own")}${keyOrTempo}`,
    sequence: album.duplicateTrackNumbers
      ? "Two tracks share a number"
      : counts.minimalStructure
        ? of(counts.minimalStructure, "has fewer than 2 sections", "have fewer than 2 sections")
        : album.repeatedEnergyProfile
          ? "Most tracks share one section pattern and tempo"
          : album.weakBookends
            ? "The opener and closer don't frame the record yet"
            : "Track order and song structure hold",
    motifs: !album.uniqueMotifs
      ? "No motifs yet"
      : album.callbackMotifs
        ? `${plural(album.callbackMotifs, "motif")} ${album.callbackMotifs === 1 ? "comes" : "come"} back on a second track`
        : "No motif comes back on a second track yet",
  };
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
    verdict: { label: "Not scored yet", tone: "neutral" },
    scoreCap: 0,
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
      songsWithStarterChords: 0,
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
      title: "No tracks yet",
      detail: "This album has no tracks yet.",
      suggestion: "Add a tracklist of at least 4 tracks to shape the arc before exporting.",
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

  let sectionCount = 0;
  let songsWithChords = 0;
  let songsWithStarterChords = 0;
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
      // The starter loop the setup writes is scaffolding, not a harmonic decision: it earns no
      // harmony credit, with or without lyrics (`@/lib/chords` owns the definition).
      const hasChords = trackHasWrittenHarmony(song.sections);
      // Chords set, none of them written: every progression is still a starter loop.
      const starterHarmony =
        !hasChords && song.sections.some((section) => !isEmptyProgression(section.chord_progression));
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
      if (starterHarmony) songsWithStarterChords += 1;
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

      return {
        trackNumber: song.track_number,
        title: song.title,
        sectionCount: song.sections.length,
        sectionPattern,
        hasChords,
        starterHarmony,
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
  // Album motifs plus track motif tags: the same source the Bible's motif index reads.
  const motifIndex = albumMotifIndex(album);
  const uniqueMotifs = motifIndex.length;
  const callbackMotifs = motifIndex.filter((motif) => motif.trackNumbers.length >= 2).length;
  const taggedMotifs = motifIndex.filter((motif) => motif.trackNumbers.length > 0);

  const dominantPatternCount = Math.max(0, ...patternCounts.values());
  const tempoSpread =
    tempos.length > 1 ? Math.max(...tempos) - Math.min(...tempos) : 0;
  const sortedTempos = Array.from(new Set(tempos)).sort((left, right) => left - right);
  const tempoFact = !tempos.length
    ? "No track has a tempo yet, so pacing can't be told apart."
    : uniqueTempos === 1
      ? tempos.length === songCount
        ? `Every track has the same tempo (${sortedTempos[0]} BPM).`
        : `Every track with a tempo is at ${sortedTempos[0]} BPM.`
      : tempoSpread <= 10
        ? `Tempos only range from ${sortedTempos[0]} to ${sortedTempos[sortedTempos.length - 1]} BPM.`
        : `The record uses only two tempos (${sortedTempos[0]} and ${sortedTempos[1]} BPM).`;
  const repeatedEnergyProfile =
    songCount >= 4 &&
    dominantPatternCount >= Math.ceil(songCount * 0.75) &&
    (uniqueTempos <= 2 || tempoSpread <= 10);

  // Every track that carries none of the album's themes, tagged or not, in sequence.
  const themeDriftTracks = albumThemes.length
    ? snapshots
        .filter((song) => !song.themes.some((theme) => albumThemes.includes(theme)))
        .map((song) => song.trackNumber)
    : [];

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
  const firstTrack = (predicate: (song: SongSnapshot) => boolean) =>
    snapshots.find(predicate)?.trackNumber;

  if (!album.concept_summary?.trim()) {
    issues.push({
      id: "missing_concept",
      severity: "warning",
      category: "narrative",
      title: "Missing concept summary",
      detail: "An album holds together better with a one-sentence premise and what is at stake.",
      suggestion: "Write a one- or two-sentence concept summary in the album details.",
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
      suggestion: "Give each track its own number before sequencing the album.",
      relatedTracks: Array.from(duplicateTrackNumbers).sort((left, right) => left - right),
      trackFocus: "song",
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
      title: "Duplicate track titles",
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
      title:
        minimalStructureSongs === 1
          ? "One track still has minimal structure"
          : `${minimalStructureSongs} tracks still have minimal structure`,
      detail: `${tracksThat(minimalStructureSongs, songCount, "has", "have")} fewer than 2 sections.`,
      suggestion: "Add at least a verse and a chorus to the thinnest tracks before another export.",
      relatedTracks: snapshots
        .filter((song) => song.sectionCount < 2)
        .map((song) => song.trackNumber),
      trackFocus: "song",
      fix: { focus: "song", trackNumber: firstTrack((song) => song.sectionCount < 2) },
    });
  }

  if (songsMissingChords > 0) {
    const starterOnly = songsWithStarterChords === songsMissingChords;
    issues.push({
      id: "missing_chords",
      severity: songsMissingChords > Math.ceil(songCount / 2) ? "warning" : "info",
      category: "harmony",
      title:
        songsMissingChords === songCount
          ? songCount === 1
            ? "The track has no chords of its own yet"
            : "No track has chords of its own yet"
          : songsMissingChords === 1
            ? `Track ${firstTrack((song) => !song.hasChords)} has no chords of its own yet`
            : `${songsMissingChords} of ${songCount} tracks have no chords of their own yet`,
      detail: songsWithStarterChords
        ? `${
            starterOnly
              ? tracksThat(songsMissingChords, songCount, "is", "are")
              : tracksThat(songsWithStarterChords, songCount, "is", "are")
          } still on the starter loop, which doesn't count until you change it.`
        : `${tracksThat(songsMissingChords, songCount, "has", "have")} no chords yet.`,
      suggestion: "Write a 4 to 8 bar progression for each of them so the harmonic arc can be judged.",
      relatedTracks: snapshots.filter((song) => !song.hasChords).map((song) => song.trackNumber),
      trackFocus: "song",
      fix: { focus: "song", trackNumber: firstTrack((song) => !song.hasChords) },
    });
  }

  if (songsMissingLyrics > 0) {
    // An empty track is the biggest gap an album can have: an error as soon as more than one
    // is empty, or any is in a short album, and always the first finding (see sortIssues).
    const emptyIsError = songsMissingLyrics > 1 || songCount <= 3;
    const emptyTracks = snapshots.filter((song) => !song.hasLyrics).map((song) => song.trackNumber);
    issues.push({
      id: "missing_lyrics",
      severity: emptyIsError ? "error" : "warning",
      category: "lyrics",
      title:
        songsMissingLyrics === songCount
          ? songCount === 1
            ? "The track still needs lyrics"
            : `All ${songCount} tracks still need lyrics`
          : songsMissingLyrics === 1
            ? `Track ${emptyTracks[0]} still needs lyrics`
            : `${songsMissingLyrics} of ${songCount} tracks still need lyrics`,
      detail: `${tracksThat(songsMissingLyrics, songCount, "has", "have")} only placeholders or no lyrics.${
        placeholderLyricsSongs
          ? ` Placeholder lines like “[Verse line 1]” don't count as written.`
          : ""
      }`,
      suggestion: "Draft at least one verse and one hook on each of them, so callbacks and hooks can be judged.",
      relatedTracks: emptyTracks,
      trackFocus: "lyrics",
      fix: { focus: "lyrics", trackNumber: emptyTracks[0] },
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
      title:
        songsMissingKeys && songsMissingTempo
          ? "Some tracks have no key or tempo"
          : songsMissingKeys
            ? songsMissingKeys === 1
              ? "One track has no key"
              : `${songsMissingKeys} tracks have no key`
            : songsMissingTempo === 1
              ? "One track has no tempo"
              : `${songsMissingTempo} tracks have no tempo`,
      detail: `${[
        songsMissingKeys ? `${tracksThat(songsMissingKeys, songCount, "has", "have")} no key` : null,
        songsMissingTempo ? `${tracksThat(songsMissingTempo, songCount, "has", "have")} no tempo` : null,
      ]
        .filter(Boolean)
        .join("; ")}.`,
      suggestion: "Set a home key and a rough tempo map so the moves between tracks feel designed.",
      relatedTracks: missingMetaTracks,
      trackFocus: "song",
      fix: { focus: "song", trackNumber: missingMetaTracks[0] },
    });
  }

  if (!uniqueThemes) {
    issues.push({
      id: "no_themes",
      severity: "info",
      category: "narrative",
      title: "No album themes yet",
      detail: "No themes are set yet, so the report can't tell whether the tracks pull in the same direction.",
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
      title:
        songsMissingNarrative.length === 1
          ? "One track has no story note"
          : `${songsMissingNarrative.length} tracks have no story note`,
      detail: `${tracksThat(songsMissingNarrative.length, songCount, "has", "have")} no story note, so ${
        songsMissingNarrative.length === 1 ? "its" : "their"
      } place in the arc can't be checked.`,
      suggestion: "Write one or two sentences on what happens in each track.",
      relatedTracks: songsMissingNarrative.map((song) => song.trackNumber),
      trackFocus: "story",
      fix: { focus: "story", trackNumber: songsMissingNarrative[0]?.trackNumber },
    });
  }

  if (albumThemes.length > 0 && songsAlignedToThemes < Math.ceil(songCount / 2)) {
    issues.push({
      id: "theme_drift",
      severity: "warning",
      category: "narrative",
      title: "Theme drift is starting to show",
      detail: songsAlignedToThemes
        ? `Only ${songsAlignedToThemes} of ${songCount} tracks carry one of the album's themes.`
        : "No track carries one of the album's themes yet.",
      suggestion: "Tag the tracks that belong, then rewrite the outliers so the arc feels intentional.",
      relatedTracks: themeDriftTracks,
      trackFocus: "song-themes",
      fix: { focus: "song-themes", trackNumber: themeDriftTracks[0] },
    });
  }

  if (!uniqueMotifs) {
    issues.push({
      id: "no_motifs",
      severity: "info",
      category: "motifs",
      title: "No motifs yet",
      detail: "The album has no motifs and no track carries a motif tag. Motifs are what make a concept album feel connected.",
      suggestion: "Name 1 to 3 motifs for the album (a sound, a symbol, a phrase) and tag them on several tracks.",
      fix: { focus: "album-motifs" },
    });
  } else if (callbackMotifs === 0) {
    // Bring the motif doing the most work back where a callback lands hardest: the opener, the
    // closer, the midpoint. Those are suggestions, not tracks with a problem.
    const topMotif = motifIndex[0];
    const topKey = topMotif?.name.toLowerCase();
    const anchors = [snapshots[0], snapshots[snapshots.length - 1], snapshots[Math.floor(snapshots.length / 2)]]
      .filter((song): song is SongSnapshot => Boolean(song))
      .filter((song, index, list) => list.findIndex((other) => other.trackNumber === song.trackNumber) === index)
      .filter((song) => !topKey || !song.motifs.includes(topKey))
      .map((song) => song.trackNumber);
    const untagged = taggedMotifs.length === 0;
    const named = motifIndex.slice(0, 3).map((motif) => `“${motif.name}”`);
    issues.push({
      id: "missing_callbacks",
      severity: "warning",
      category: "motifs",
      title: untagged ? "The album's motifs aren't on any track yet" : "Motifs are not coming back yet",
      detail: untagged
        ? `The album names ${plural(motifIndex.length, "motif")} (${named.join(", ")}${motifIndex.length > 3 ? "…" : ""}), but no track is tagged with ${motifIndex.length === 1 ? "it" : "one"} yet.`
        : `${plural(taggedMotifs.length, "motif")} ${taggedMotifs.length === 1 ? "is" : "are"} tagged on tracks, but none comes back on a second track yet.`,
      suggestion: topMotif
        ? `${untagged ? "Tag" : "Bring back"} “${topMotif.name}” on the opener, the closer or the midpoint so the callback lands.`
        : "Bring one motif back on the opener, the closer or the midpoint so the callback lands.",
      suggestedTracks: anchors.slice().sort((left, right) => left - right),
      trackFocus: "motifs",
      fix: anchors.length ? { focus: "motifs", trackNumber: anchors[0] } : { focus: "album-motifs" },
    });
  }

  if (songsWithoutChorus > Math.ceil(songCount / 2)) {
    issues.push({
      id: "weak_hooks",
      severity: "info",
      category: "lyrics",
      title: "Hook structure is still under-defined",
      detail: `${tracksThat(songsWithoutChorus, songCount, "has", "have")} no chorus section yet.`,
      suggestion: "Add chorus sections where they fit so the album has memorable anchors.",
      relatedTracks: snapshots.filter((song) => !song.hasChorus).map((song) => song.trackNumber),
      trackFocus: "song",
      fix: { focus: "song", trackNumber: firstTrack((song) => !song.hasChorus) },
    });
  }

  if (repeatedEnergyProfile) {
    issues.push({
      id: "repeated_energy_profile",
      severity: "warning",
      category: "sequence",
      title: "The album's section energy repeats too often",
      detail: `Most tracks share the same section pattern. ${tempoFact}`,
      suggestion: "Vary tempo, section order or pacing so the middle of the record doesn't flatten out.",
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
      suggestion: "In the opener's and closer's story notes, give them a shared callback, motif or narrative echo.",
      relatedTracks: [opener?.trackNumber, closer?.trackNumber].filter(
        (trackNumber): trackNumber is number => typeof trackNumber === "number",
      ),
      trackFocus: "story",
      fix: { focus: "story", trackNumber: opener?.trackNumber },
    });
  }

  const sortedIssues = sortIssues(issues);

  const albumFacts: AlbumFacts = {
    songCount,
    hasConcept: Boolean(album.concept_summary?.trim()),
    albumThemeCount: albumThemes.length,
    uniqueThemes,
    uniqueMotifs,
    callbackMotifs,
    weakBookends,
    duplicateTrackNumbers: duplicateTrackNumbers.size > 0,
    repeatedEnergyProfile,
    singleKey: songCount >= 4 && uniqueKeys <= 1 && songsMissingKeys === 0,
  };
  const rawScores = dimensionScores(countTracks(snapshots, albumThemes), albumFacts);
  // The same measures on the written tracks alone: what each dimension scores on its own
  // while the cap holds them all at the share of written tracks. Once every track is written
  // (or none is) this is the whole album again.
  const writtenSongs = snapshots.filter((song) => song.hasLyrics);
  const partlyWritten = writtenSongs.length > 0 && writtenSongs.length < songCount;
  const measuredCounts = countTracks(partlyWritten ? writtenSongs : snapshots, albumThemes);
  const uncapped = partlyWritten ? dimensionScores(measuredCounts, albumFacts) : rawScores;
  const signals = dimensionSignals(measuredCounts, albumFacts, partlyWritten ? "written track" : "track");

  // A score needs lyrics to judge. A one-track album needs only its one track written.
  const requiredWrittenTracks = Math.max(1, Math.min(MIN_WRITTEN_TRACKS_FOR_SCORE, songCount));
  const insufficient = songsWithLyrics < requiredWrittenTracks;

  // No dimension may score above the share of tracks that are written: a report can't call
  // the lyrics 74/100 while half the tracks have none. Harmony is also held to the share of
  // tracks with chords of their own, so the starter loop never earns it credit.
  const scoreCap = songCount ? clampScore((songsWithLyrics / songCount) * 100) : 0;
  const harmonyCap = songCount ? Math.min(scoreCap, clampScore((songsWithChords / songCount) * 100)) : 0;
  const writtenFact = `only ${songsWithLyrics} of ${songCount} tracks ${songsWithLyrics === 1 ? "is" : "are"} written`;
  const capped = (key: CoherenceDimension, summary: string, cap = scoreCap, capReason = writtenFact) => {
    const limited = Math.min(rawScores[key], cap);
    return buildBreakdownItem(key, limited, summary, {
      uncapped: uncapped[key],
      // Unscored reports show what each dimension needs, not a cap nobody can see.
      heldBecause: limited < uncapped[key] && !insufficient ? capReason : undefined,
      signal: signals[key],
    });
  };

  const breakdown = [
    capped(
      "narrative",
      !album.concept_summary?.trim()
        ? "The album has no concept summary yet, and the tracks' story notes have nothing to answer to."
        : songsWithNarrativeSummary < songCount
          ? `${songsWithNarrativeSummary} of ${songCount} tracks have a story note.`
          : weakBookends
            ? "The arc exists, but the opener and closer are not framing it strongly yet."
            : "The concept and every track's story note are in place.",
    ),
    capped(
      "lyrics",
      songsMissingLyrics
        ? `${songsWithLyrics} of ${songCount} tracks have lyrics written; the rest are placeholders or empty.`
        : "Every track has lyrics written, so callbacks and hooks can be judged.",
    ),
    capped(
      "harmony",
      songsMissingChords
        ? `${songsWithChords} of ${songCount} tracks have chords of their own${
            songsWithStarterChords ? `; ${plural(songsWithStarterChords, "track")} still ${songsWithStarterChords === 1 ? "has" : "have"} the starter loop` : ""
          }.`
        : songsMissingKeys || songsMissingTempo
          ? "Every track has chords of its own; some still need a key or tempo."
          : "Every track has chords of its own, a key and a tempo.",
      harmonyCap,
      harmonyCap < scoreCap
        ? `only ${songsWithChords} of ${songCount} tracks ${songsWithChords === 1 ? "has" : "have"} chords of ${songsWithChords === 1 ? "its" : "their"} own`
        : writtenFact,
    ),
    capped(
      "sequence",
      repeatedEnergyProfile
        ? "Tempo and section energy need more contrast across the record."
        : "Track order and internal song structure are mostly holding together.",
    ),
    capped(
      "motifs",
      !uniqueMotifs
        ? "No motifs yet, on the album or on any track."
        : callbackMotifs
          ? `${plural(callbackMotifs, "motif")} ${callbackMotifs === 1 ? "comes" : "come"} back on more than one track.`
          : "Motifs need to come back on more than one track to make the record feel connected.",
    ),
  ];

  const weightedScore =
    breakdown[0].score * 0.28 +
    breakdown[1].score * 0.2 +
    breakdown[2].score * 0.18 +
    breakdown[3].score * 0.18 +
    breakdown[4].score * 0.16;
  const score = clampScore(weightedScore);
  const weakest = weakestDimension({ breakdown });
  const topIssue = sortedIssues[0];

  const missing: CoherenceMissingPiece[] = [];
  if (insufficient) {
    if (!songCount) {
      missing.push({ id: "tracks", label: "A tracklist: add the first tracks", fix: { focus: "song" } });
    } else {
      const needed = requiredWrittenTracks - songsWithLyrics;
      missing.push({
        id: "lyrics",
        label: `Lyrics on ${needed === 1 ? "one more track" : `${needed} more tracks`} (${songsWithLyrics} of ${requiredWrittenTracks} written)`,
        fix: { focus: "lyrics", trackNumber: firstTrack((song) => !song.hasLyrics) },
      });
    }
    if (!album.concept_summary?.trim()) {
      missing.push({ id: "concept", label: "A concept summary for the album", fix: { focus: "album" } });
    }
    if (songCount && !snapshots.some((song) => song.themes.length > 0)) {
      missing.push({
        id: "themes",
        label: "Themes tagged on at least one track",
        fix: { focus: "song-themes", trackNumber: snapshots[0]?.trackNumber },
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

  const verdict = coherenceVerdict({ insufficient, score, songCount, songsWithLyrics });
  const summary = insufficient
    ? requiredWrittenTracks === 1
      ? "Not enough material yet — write lyrics for this track to get a score."
      : "Not enough material yet — write lyrics for two tracks to get a score."
    : songsMissingLyrics
      ? `${score}/100 overall, and unfinished: ${songsWithLyrics} of ${songCount} tracks are written, so no dimension scores above ${scoreCap}. Finish the empty ${songsMissingLyrics === 1 ? "track" : "tracks"} first; on the written ${songsWithLyrics === 1 ? "one" : "ones"}, ${weakest.label} is weakest.`
      : topIssue
        ? `${score}/100 overall. Weakest area: ${weakest.label} (${weakest.score}/100). Top issue: ${topIssue.title}.`
        : `${score}/100 overall. The album is structurally coherent across the current draft.`;

  return {
    score,
    summary,
    insufficient,
    missing,
    verdict,
    scoreCap,
    stats: {
      songCount,
      sectionCount,
      songsWithChords,
      songsWithStarterChords,
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
