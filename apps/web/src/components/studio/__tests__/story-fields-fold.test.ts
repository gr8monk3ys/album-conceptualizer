import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  STORY_FIELDS_BODY_ID,
  STORY_FIELDS_TOGGLE_ID,
  StoryFieldsFold,
  storyFieldsSummary,
  storyNoteExcerpt,
} from "@/components/studio/song-story-editor";
import type { StudioSong } from "@/components/studio/studio-model";
import { TrackThemeToggles } from "@/components/studio/track-list";

const song = (patch: Partial<StudioSong> = {}): StudioSong =>
  ({ track_number: 1, title: "Low Tide", sections: [], ...patch }) as StudioSong;

describe("storyNoteExcerpt", () => {
  it("keeps a short note whole", () => {
    expect(storyNoteExcerpt("She leaves before the storm.")).toBe("She leaves before the storm.");
  });

  it("cuts a long note at a whole word, without a dangling comma", () => {
    expect(storyNoteExcerpt("She leaves the lighthouse before the storm reaches the coast.")).toBe(
      "She leaves the lighthouse before the…",
    );
    expect(storyNoteExcerpt("One, two, three, four, five, six, seven")).toBe("One, two, three, four, five, six…");
  });

  it("is empty for no note or only spaces", () => {
    expect(storyNoteExcerpt(null)).toBe("");
    expect(storyNoteExcerpt("   ")).toBe("");
  });
});

describe("storyFieldsSummary", () => {
  it("says what is still missing", () => {
    expect(storyFieldsSummary(song())).toBe("No role yet · no Story note yet");
  });

  it("names the role and the note's first words", () => {
    expect(
      storyFieldsSummary(song({ narrative_position: " Opening ", narrative_summary: "She leaves before the storm." })),
    ).toBe("Opening · She leaves before the storm.");
  });

  it("adds which album themes the track carries, in the spine's words", () => {
    const themes = ["memory", "tide", "signal"];
    expect(storyFieldsSummary(song({ themes: ["Tide"] }), themes)).toBe(
      "No role yet · no Story note yet · Carries tide",
    );
    expect(storyFieldsSummary(song({ themes: [] }), themes)).toBe(
      "No role yet · no Story note yet · Carries none of the album themes",
    );
    // Blank album themes are no themes.
    expect(storyFieldsSummary(song(), [" "])).toBe("No role yet · no Story note yet");
  });

  it("never starts a wrapped line with a separator", () => {
    const summary = storyFieldsSummary(song({ narrative_position: "Turn", narrative_summary: "A call." }), ["tide"]);
    for (const part of summary.split(" ").slice(1)) expect(part.startsWith("·")).toBe(false);
  });
});

describe("StoryFieldsFold", () => {
  const render = (open: boolean) =>
    renderToStaticMarkup(
      h(StoryFieldsFold, {
        summary: "No role yet",
        open,
        onOpenChange: () => {},
        children: h("input", { id: "song-narrative-summary" }),
      }),
    );

  it("is a disclosure that controls the fields and says whether it is open", () => {
    const closed = render(false);
    expect(closed).toContain(`id="${STORY_FIELDS_TOGGLE_ID}"`);
    expect(closed).toContain(`aria-controls="${STORY_FIELDS_BODY_ID}"`);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain("Edit");
    expect(render(true)).toContain('aria-expanded="true"');
    expect(render(true)).toContain("Hide");
  });

  it("folds only below 42rem: the toggle is hidden from 42rem and the fields always render", () => {
    const closed = render(false);
    expect(closed).toMatch(/<h3 class="[^"]*@2xl\/studio:hidden/);
    expect(closed).toMatch(new RegExp(`id="${STORY_FIELDS_BODY_ID}" class="[^"]*@max-2xl/studio:hidden`));
    expect(closed).toContain('id="song-narrative-summary"');
    expect(render(true)).not.toContain("@max-2xl/studio:hidden");
  });
});

describe("TrackThemeToggles in its two places", () => {
  const render = (place: "story" | "details") =>
    renderToStaticMarkup(
      h(TrackThemeToggles, {
        song: song({ id: "s1", themes: ["tide"] }),
        centralThemes: ["memory", "tide"],
        onToggle: () => {},
        place,
      }),
    );

  it("labels each copy with its own id, so both can be on the page", () => {
    expect(render("story")).toContain('aria-labelledby="track-theme-toggles-story-s1"');
    expect(render("details")).toContain('aria-labelledby="track-theme-toggles-details-s1"');
  });

  it("shows which themes the track carries", () => {
    expect(render("details")).toMatch(/aria-pressed="true"[^>]*>tide</);
    expect(render("details")).toMatch(/aria-pressed="false"[^>]*>memory</);
  });
});
