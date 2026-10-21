// The One Score Story (DESIGN.md, Coherence report): every surface that shows an album's
// coherence tells it in the same order and the same words. While tracks are unwritten the
// headline is progress ("3 of 10 tracks written · Unfinished") and both scores follow in one
// fixed order ("Written tracks 65/100 · Whole album 25/100"); once every track is written
// there is one score. Pure and client-safe: it reads only the fields it names from a
// Coherence report (`analyzeAlbumCoherence` in server/coherence.ts).

/** The parts of a Coherence report the story is told from. */
export type ScoreStoryInput = {
  insufficient: boolean;
  score: number;
  writtenScore: number | null;
  verdict: { label: string; tone: "ok" | "neutral" | "warn" | "danger" };
  stats: { songCount: number; songsWithLyrics: number };
};

export type ScoreFigure = {
  /** "Written tracks" and "Whole album" while tracks are unwritten; null for the one score. */
  label: "Written tracks" | "Whole album" | null;
  value: number;
};

export type ScoreStory = {
  /** "3 of 10 tracks written", or null once every track is written (or there are none). */
  progress: string | null;
  /** The Coherence verdict label: "Unfinished", "Not scored yet", "Solid"… */
  verdict: string;
  /** The verdict's tone. "Unfinished" and "Not scored yet" are neutral ink. */
  tone: ScoreStoryInput["verdict"]["tone"];
  /** "3 of 10 tracks written · Unfinished" while unfinished; the verdict alone once finished. */
  headline: string;
  /** Written tracks first, then the whole album; one figure once finished; none unscored. */
  scores: ScoreFigure[];
  /** "Written tracks 65/100 · Whole album 25/100", "72/100", or "" when there is no score. */
  scoreLine: string;
  /** The whole story as one line: the headline, then the score line. */
  text: string;
};

/** "Written tracks 65/100", "72/100". */
export function formatScoreFigure(figure: ScoreFigure) {
  return figure.label ? `${figure.label} ${figure.value}/100` : `${figure.value}/100`;
}

/** The album's coherence as headline plus scores, in the one order every surface uses. */
export function scoreStory(report: ScoreStoryInput): ScoreStory {
  const { songCount, songsWithLyrics } = report.stats;
  const finished = songCount > 0 && songsWithLyrics >= songCount;
  const progress =
    songCount > 0 && !finished
      ? `${songsWithLyrics} of ${songCount} ${songCount === 1 ? "track" : "tracks"} written`
      : null;
  const verdict = report.verdict.label;

  const scores: ScoreFigure[] = report.insufficient
    ? []
    : finished
      ? [{ label: null, value: report.score }]
      : [
          ...(report.writtenScore !== null
            ? [{ label: "Written tracks" as const, value: report.writtenScore }]
            : []),
          { label: "Whole album" as const, value: report.score },
        ];

  const headline = progress ? `${progress} · ${verdict}` : verdict;
  const scoreLine = scores.map(formatScoreFigure).join(" · ");
  return {
    progress,
    verdict,
    tone: report.verdict.tone,
    headline,
    scores,
    scoreLine,
    text: scoreLine ? `${headline} · ${scoreLine}` : headline,
  };
}

/** The parts of a "By dimension" row its figure is told from (`CoherenceBreakdownItem`). */
export type DimensionFigureInput = {
  score: number;
  uncapped: number;
  heldBecause?: string;
  heldBy?: "lyrics" | "chords";
  heldUntil?: string;
};

export type DimensionFigure = {
  /**
   * The figure a row leads with. While tracks are unwritten it is what the written tracks score
   * on that dimension (the capped whole-album figure would read the same on every row); once
   * every track is written it is the one score.
   */
  value: number;
  /** "Written tracks" while tracks are unwritten; null for the one score. */
  label: "Written tracks" | null;
  /**
   * The whole album's figure, said small under the row while tracks are unwritten: "Whole album
   * 42/100.", or "Capped at 38 for the whole album." when the lyric cap holds it (the reason is
   * said once for every row, `wholeAlbumCapLine`), with its own reason when Harmony's chords
   * cap holds it. Null once every track is written and nothing holds the row.
   */
  note: string | null;
};

function unfinished(report: ScoreStoryInput) {
  const { songCount, songsWithLyrics } = report.stats;
  return songCount > 0 && songsWithLyrics < songCount;
}

/** A dimension's figure in the One Score Story's order: written tracks first. Null unscored. */
export function dimensionFigure(item: DimensionFigureInput, report: ScoreStoryInput): DimensionFigure | null {
  if (report.insufficient) return null;
  const held = Boolean(item.heldBecause);
  if (!unfinished(report)) {
    return {
      value: item.score,
      label: null,
      note:
        held && item.heldUntil
          ? `Held at ${item.score} until ${item.heldUntil}; on its own it scores ${item.uncapped}.`
          : null,
    };
  }
  const note = !held
    ? `Whole album ${item.score}/100.`
    : item.heldBy === "chords" && item.heldUntil
      ? `Capped at ${item.score} for the whole album until ${item.heldUntil}.`
      : `Capped at ${item.score} for the whole album.`;
  return { value: item.uncapped, label: "Written tracks", note };
}

/**
 * The lyric cap, said once for every dimension while tracks are unwritten: "For the whole
 * album, every dimension is capped at 38 until 5 more tracks have lyrics." Null otherwise.
 */
export function wholeAlbumCapLine(report: ScoreStoryInput & { scoreCap: number }): string | null {
  if (report.insufficient || !unfinished(report)) return null;
  const left = report.stats.songCount - report.stats.songsWithLyrics;
  return `For the whole album, every dimension is capped at ${report.scoreCap} until ${
    left === 1 ? "1 more track has" : `${left} more tracks have`
  } lyrics.`;
}
