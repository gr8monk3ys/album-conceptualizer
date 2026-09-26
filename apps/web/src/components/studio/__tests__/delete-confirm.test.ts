import { describe, expect, it } from "vitest";

import { deleteSectionQuestion, deleteTrackQuestion } from "@/components/studio/delete-confirm";
import { tracksSummary } from "@/components/studio/tracks-disclosure";

describe("delete questions name what goes", () => {
  it("names the track and how many written sections it holds", () => {
    expect(deleteTrackQuestion("Track 1", 1, 2)).toBe("Delete Track 1 and its 2 written sections?");
    expect(deleteTrackQuestion("Storm Warning", 4, 1)).toBe("Delete Storm Warning and its 1 written section?");
    expect(deleteTrackQuestion("  ", 3, 2)).toBe("Delete track 3 and its 2 written sections?");
  });

  it("names the section", () => {
    expect(deleteSectionQuestion("Verse 2")).toBe("Delete Verse 2 and its written lyrics?");
  });
});

describe("tracksSummary", () => {
  it("says where you are in the sequence", () => {
    expect(tracksSummary({ track_number: 4, title: "Track 4" }, 10)).toBe("Sequence · 04 of 10 · Track 4");
    expect(tracksSummary({ track_number: 1, title: " " }, 3)).toBe("Sequence · 01 of 03 · Untitled");
    expect(tracksSummary(undefined, 0)).toBe("Sequence");
  });
});
