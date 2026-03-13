import type { AlbumJson } from "@/server/album-json";
import { AlbumJsonSchema } from "@/server/album-json";
import type { AlbumRoughDemoRecord } from "@/server/rough-demos";
import { listAlbumRoughDemos } from "@/server/rough-demos";
import { getAlbumStyleBible } from "@/server/style-bible";

export type RoughDemoReviewTrack = {
  trackNumber: number;
  title: string;
  reason: string;
};

export type RoughDemoReview = {
  demoId: string;
  signalScore: number;
  readinessLabel: "Needs shape" | "Developing" | "Ready";
  headline: string;
  suggestedPlacement: string;
  targetMode: "explicit" | "suggested" | "unassigned";
  recommendedTrack: RoughDemoReviewTrack | null;
  matchedThemes: string[];
  matchedMotifs: string[];
  styleAnchors: string[];
  focusTags: string[];
  nextMoves: string[];
  concerns: string[];
  readyForHandoff: boolean;
};

export type RoughDemoReviewSummary = {
  readyCount: number;
  developingCount: number;
  unassignedCount: number;
  strongCount: number;
  topHeadline: string | null;
};

export type RoughDemoCollection = {
  demos: AlbumRoughDemoRecord[];
  reviews: RoughDemoReview[];
};

type ReviewSongContext = {
  trackNumber: number;
  title: string;
  narrativeSummary: string | null;
  themes: string[];
  motifs: string[];
  moodTags: string[];
  instrumentation: string[];
};

const PLACEMENT_BY_SOURCE: Record<string, string> = {
  "voice-memo": "Lyric and melody scratchpad",
  "phone-demo": "Early melodic seed worth tightening",
  rehearsal: "Arrangement checkpoint for the band pass",
  "riff-sketch": "Intro or verse riff candidate",
  "acoustic-pass": "Bridge or stripped-down interlude candidate",
  "hook-sketch": "Chorus or post-chorus candidate",
};

function tokenize(value: string) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => token.length >= 3 || /^\d+$/.test(token),
  );
}

function buildTokenSet(values: Array<string | null | undefined>) {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const token of tokenize(value)) tokens.add(token);
  }
  return tokens;
}

function uniqueList(values: string[], limit = 5) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
    if (items.length >= limit) break;
  }
  return items;
}

function hasTokenOverlap(tokens: Set<string>, phrase: string) {
  const phraseTokens = tokenize(phrase);
  return phraseTokens.some((token) => tokens.has(token));
}

function matchPhrases(tokens: Set<string>, phrases: string[], limit = 4) {
  return uniqueList(phrases.filter((phrase) => hasTokenOverlap(tokens, phrase)), limit);
}

function getPlacementLabel(sourceKind: string) {
  return PLACEMENT_BY_SOURCE[sourceKind] ?? "Album idea worth structuring";
}

function getReadinessLabel(signalScore: number): RoughDemoReview["readinessLabel"] {
  if (signalScore >= 75) return "Ready";
  if (signalScore >= 50) return "Developing";
  return "Needs shape";
}

function getSongs(album: AlbumJson): ReviewSongContext[] {
  return album.songs
    .map((song) => ({
      trackNumber: song.track_number,
      title: song.title,
      narrativeSummary: song.narrative_summary ?? null,
      themes: Array.isArray(song.themes) ? song.themes : [],
      motifs: Array.isArray(song.motifs) ? song.motifs : [],
      moodTags: Array.isArray(song.mood_tags) ? song.mood_tags : [],
      instrumentation: Array.isArray(song.instrumentation) ? song.instrumentation : [],
    }))
    .sort((left, right) => left.trackNumber - right.trackNumber);
}

function scoreSongMatch(tokens: Set<string>, song: ReviewSongContext) {
  const titleMatch = hasTokenOverlap(tokens, song.title);
  const themeMatches = matchPhrases(tokens, song.themes, 3);
  const motifMatches = matchPhrases(tokens, song.motifs, 3);
  const moodMatches = matchPhrases(tokens, song.moodTags, 2);
  const instrumentationMatches = matchPhrases(tokens, song.instrumentation, 2);
  const summaryMatches = song.narrativeSummary
    ? matchPhrases(tokens, [song.narrativeSummary], 1)
    : [];

  const score =
    (titleMatch ? 4 : 0) +
    themeMatches.length * 5 +
    motifMatches.length * 4 +
    moodMatches.length * 3 +
    instrumentationMatches.length * 2 +
    summaryMatches.length * 2;

  const reasonParts = uniqueList(
    [
      titleMatch ? `title: ${song.title}` : "",
      themeMatches.length ? `themes: ${themeMatches.join(", ")}` : "",
      motifMatches.length ? `motifs: ${motifMatches.join(", ")}` : "",
      moodMatches.length ? `mood: ${moodMatches.join(", ")}` : "",
      instrumentationMatches.length ? `arrangement: ${instrumentationMatches.join(", ")}` : "",
    ],
    2,
  );

  return {
    score,
    reason:
      reasonParts.length > 0
        ? `Best overlap on ${reasonParts.join(" · ")}.`
        : "Best overall theme and arrangement overlap.",
  };
}

function getRecommendedTrack(
  demo: AlbumRoughDemoRecord,
  songs: ReviewSongContext[],
  tokens: Set<string>,
) {
  if (demo.song_track_number) {
    const explicitSong = songs.find((song) => song.trackNumber === demo.song_track_number);
    return {
      targetMode: "explicit" as const,
      recommendedTrack: {
        trackNumber: demo.song_track_number,
        title: explicitSong?.title ?? `Track ${demo.song_track_number}`,
        reason: "Pinned to this track in the rough demo capture.",
      },
    };
  }

  const ranked = songs
    .map((song) => ({ song, ...scoreSongMatch(tokens, song) }))
    .sort((left, right) => right.score - left.score || left.song.trackNumber - right.song.trackNumber);

  if (!ranked[0] || ranked[0].score <= 0) {
    return {
      targetMode: "unassigned" as const,
      recommendedTrack: null,
    };
  }

  return {
    targetMode: "suggested" as const,
    recommendedTrack: {
      trackNumber: ranked[0].song.trackNumber,
      title: ranked[0].song.title,
      reason: ranked[0].reason,
    },
  };
}

function buildSignalScore(demo: AlbumRoughDemoRecord) {
  let score = 0;
  if (demo.title && demo.title !== "Untitled demo") score += 6;
  if (demo.capture_notes) score += 24;
  score += Math.min(demo.sonic_traits.length, 4) * 4;
  score += Math.min(demo.lyrical_fragments.length, 3) * 6;
  score += Math.min(demo.next_actions.length, 3) * 4;
  if (demo.song_track_number) score += 8;
  if (demo.external_url || demo.local_file) score += 10;
  if (demo.local_file?.duration_seconds) score += 6;
  return Math.min(score, 100);
}

function buildHeadline(input: {
  readinessLabel: RoughDemoReview["readinessLabel"];
  placement: string;
  target: RoughDemoReviewTrack | null;
  targetMode: RoughDemoReview["targetMode"];
}) {
  if (input.target) {
    if (input.targetMode === "explicit") {
      return `${input.placement} locked to Track ${input.target.trackNumber}: ${input.target.title}`;
    }
    return `${input.placement} likely fits Track ${input.target.trackNumber}: ${input.target.title}`;
  }

  if (input.readinessLabel === "Ready") {
    return `${input.placement} is ready for a track decision`;
  }
  return `${input.placement} still needs a clearer home`;
}

function buildReview(album: AlbumJson, demo: AlbumRoughDemoRecord): RoughDemoReview {
  const songs = getSongs(album);
  const styleBible = getAlbumStyleBible(album);
  const tokenPool = buildTokenSet([
    demo.title,
    demo.capture_notes,
    demo.external_url,
    ...demo.sonic_traits,
    ...demo.lyrical_fragments,
    ...demo.next_actions,
  ]);

  const matchedThemes = matchPhrases(tokenPool, album.central_themes, 4);
  const matchedMotifs = matchPhrases(tokenPool, album.recurring_motifs, 4);
  const styleAnchors = matchPhrases(
    tokenPool,
    [
      ...styleBible.sonic_palette,
      ...styleBible.vocal_attributes,
      ...styleBible.emotional_targets,
    ],
    4,
  );
  const signalScore = buildSignalScore(demo);
  const readinessLabel = getReadinessLabel(signalScore);
  const placement = getPlacementLabel(demo.source_kind);
  const { targetMode, recommendedTrack } = getRecommendedTrack(demo, songs, tokenPool);

  const concerns = uniqueList(
    [
      demo.song_track_number ? "" : "No track target is pinned yet.",
      demo.lyrical_fragments.length ? "" : "No lyrical fragments are saved yet.",
      demo.sonic_traits.length ? "" : "No sonic traits are captured yet.",
      demo.next_actions.length ? "" : "No concrete next moves are listed yet.",
      matchedThemes.length || matchedMotifs.length
        ? ""
        : album.central_themes.length || album.recurring_motifs.length
          ? "This memo is not tied back to a clear album theme or motif yet."
          : "",
      styleAnchors.length || !styleBible.sonic_palette.length
        ? ""
        : "The memo is not yet translated into the saved style palette.",
    ],
    4,
  );

  const nextMoves = uniqueList(
    [
      targetMode === "suggested" && recommendedTrack
        ? `Try this against Track ${recommendedTrack.trackNumber}: ${recommendedTrack.title}.`
        : "",
      targetMode === "unassigned"
        ? "Assign a track target once the hook or narrative role is clearer."
        : "",
      !demo.lyrical_fragments.length ? "Capture one memorable lyric fragment before export." : "",
      !demo.next_actions.length ? "Write down one production or rewrite move before leaving this page." : "",
      !styleAnchors.length && styleBible.sonic_palette.length
        ? `Translate the idea into palette terms like ${styleBible.sonic_palette.slice(0, 2).join(" and ")}.`
        : "",
      !matchedThemes.length && album.central_themes.length
        ? `Tie the demo back to one album theme such as ${album.central_themes[0]}.`
        : "",
    ],
    3,
  );

  const focusTags = uniqueList(
    [
      ...demo.sonic_traits,
      ...demo.lyrical_fragments,
      ...matchedThemes,
      ...matchedMotifs,
      ...styleAnchors,
    ],
    6,
  );
  const readyForHandoff =
    signalScore >= 75 &&
    Boolean(recommendedTrack) &&
    Boolean(demo.capture_notes || demo.sonic_traits.length || demo.lyrical_fragments.length);

  return {
    demoId: demo.id,
    signalScore,
    readinessLabel,
    headline: buildHeadline({
      readinessLabel,
      placement,
      target: recommendedTrack,
      targetMode,
    }),
    suggestedPlacement: placement,
    targetMode,
    recommendedTrack,
    matchedThemes,
    matchedMotifs,
    styleAnchors,
    focusTags,
    nextMoves,
    concerns,
    readyForHandoff,
  };
}

function analyzeParsedAlbumRoughDemos(album: AlbumJson, demos: AlbumRoughDemoRecord[]) {
  return demos.map((demo) => buildReview(album, demo));
}

export function buildRoughDemoCollection(data: unknown): RoughDemoCollection {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) {
    return { demos: [], reviews: [] };
  }

  const demos = listAlbumRoughDemos(parsed.data);
  return {
    demos,
    reviews: analyzeParsedAlbumRoughDemos(parsed.data, demos),
  };
}

export function analyzeAlbumRoughDemos(data: unknown) {
  return buildRoughDemoCollection(data).reviews;
}

export function summarizeRoughDemoReviews(reviews: RoughDemoReview[]): RoughDemoReviewSummary {
  return {
    readyCount: reviews.filter((review) => review.readyForHandoff).length,
    developingCount: reviews.filter((review) => review.readinessLabel === "Developing").length,
    unassignedCount: reviews.filter((review) => review.targetMode === "unassigned").length,
    strongCount: reviews.filter((review) => review.signalScore >= 75).length,
    topHeadline: reviews[0]?.headline ?? null,
  };
}
