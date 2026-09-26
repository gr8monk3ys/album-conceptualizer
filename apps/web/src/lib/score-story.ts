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
