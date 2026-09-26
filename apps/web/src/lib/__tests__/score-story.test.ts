import { describe, expect, it } from "vitest";

import { formatScoreFigure, scoreStory, type ScoreStoryInput } from "@/lib/score-story";
import { analyzeAlbumCoherence } from "@/server/coherence";

function report(overrides: Partial<ScoreStoryInput> & { songCount: number; songsWithLyrics: number }): ScoreStoryInput {
  const { songCount, songsWithLyrics, ...rest } = overrides;
  return {
    insufficient: false,
    score: 25,
    writtenScore: 65,
    verdict: { label: "Unfinished", tone: "neutral" },
    stats: { songCount, songsWithLyrics },
    ...rest,
  };
}

describe("scoreStory", () => {
  it("leads an unfinished album with progress, then both scores in one fixed order", () => {
    const story = scoreStory(report({ songCount: 10, songsWithLyrics: 3 }));
    expect(story.headline).toBe("3 of 10 tracks written · Unfinished");
    expect(story.tone).toBe("neutral");
    expect(story.scores).toEqual([
      { label: "Written tracks", value: 65 },
      { label: "Whole album", value: 25 },
    ]);
    expect(story.scoreLine).toBe("Written tracks 65/100 · Whole album 25/100");
    expect(story.text).toBe("3 of 10 tracks written · Unfinished · Written tracks 65/100 · Whole album 25/100");
  });

  it("gives one score once every track is written", () => {
    const story = scoreStory(
      report({ songCount: 8, songsWithLyrics: 8, score: 72, writtenScore: null, verdict: { label: "Solid", tone: "neutral" } }),
    );
    expect(story.progress).toBeNull();
    expect(story.headline).toBe("Solid");
    expect(story.scores).toEqual([{ label: null, value: 72 }]);
    expect(story.text).toBe("Solid · 72/100");
  });

  it("shows progress and no score before there is enough to score", () => {
    const story = scoreStory(
      report({
        songCount: 6,
        songsWithLyrics: 1,
        insufficient: true,
        writtenScore: null,
        verdict: { label: "Not scored yet", tone: "neutral" },
      }),
    );
    expect(story.headline).toBe("1 of 6 tracks written · Not scored yet");
    expect(story.scores).toEqual([]);
    expect(story.text).toBe(story.headline);
  });

  it("says track, not tracks, for a single-track album, and nothing about progress with no tracks", () => {
    expect(
      scoreStory(report({ songCount: 1, songsWithLyrics: 0, insufficient: true, verdict: { label: "Not scored yet", tone: "neutral" } }))
        .headline,
    ).toBe("0 of 1 track written · Not scored yet");
    expect(
      scoreStory(report({ songCount: 0, songsWithLyrics: 0, insufficient: true, verdict: { label: "Not scored yet", tone: "neutral" } }))
        .headline,
    ).toBe("Not scored yet");
  });

  it("never leads with the whole album's score, even without a written-tracks score", () => {
    const story = scoreStory(report({ songCount: 4, songsWithLyrics: 2, writtenScore: null }));
    expect(story.scoreLine).toBe("Whole album 25/100");
  });

  it("tells a real Coherence report's story in the report's own figures", () => {
    const song = (index: number, written: boolean) => ({
      title: `Track ${index + 1}`,
      track_number: index + 1,
      key: "C",
      tempo: 100 + index * 7,
      narrative_summary: `What happens in track ${index + 1}.`,
      themes: ["distance"],
      motifs: ["headlights"],
      sections: [
        {
          section_type: "verse",
          order: 1,
          lyrics: written ? `The lights go out on street number ${index + 1}` : "[Verse line 1]",
          chord_progression: ["Am", "F", "C", "G"],
        },
      ],
    });
    const data = {
      title: "City Lights",
      concept_summary: "A record about false exits.",
      central_themes: ["distance"],
      recurring_motifs: ["headlights"],
      songs: Array.from({ length: 8 }, (_, index) => song(index, index < 3)),
    };
    const coherence = analyzeAlbumCoherence(data);
    const story = scoreStory(coherence);
    expect(story.headline).toBe("3 of 8 tracks written · Unfinished");
    expect(story.scoreLine).toBe(
      `Written tracks ${coherence.writtenScore}/100 · Whole album ${coherence.score}/100`,
    );
  });
});

describe("formatScoreFigure", () => {
  it("names the score when it has a name", () => {
    expect(formatScoreFigure({ label: "Whole album", value: 25 })).toBe("Whole album 25/100");
    expect(formatScoreFigure({ label: null, value: 90 })).toBe("90/100");
  });
});
