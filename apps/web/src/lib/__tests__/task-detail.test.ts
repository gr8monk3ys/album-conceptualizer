import { describe, expect, it } from "vitest";

import { taskDetail } from "@/lib/task-detail";

describe("taskDetail", () => {
  it("adds nothing when the body is the title", () => {
    expect(taskDetail("Tighten the second verse", "Tighten the second verse")).toBeNull();
    expect(taskDetail("Tighten the second verse", "  Tighten the second verse \n")).toBeNull();
    expect(taskDetail("Tighten the second verse", null)).toBeNull();
    expect(taskDetail("Tighten the second verse", "")).toBeNull();
  });

  it("shows only the lines after a first-line title", () => {
    expect(
      taskDetail("Tighten the second verse", "Tighten the second verse\nIt repeats the first one."),
    ).toBe("It repeats the first one.");
    expect(taskDetail("Verse", "Verse\n\nLine two\nLine three")).toBe("Line two\nLine three");
  });

  it("continues a title that was cut, from where it stopped", () => {
    const body = `${"a ".repeat(50)}landing on the tonic earlier.`;
    const title = `${body.slice(0, 90)}…`;
    const detail = taskDetail(title, body);
    expect(detail?.startsWith("…")).toBe(true);
    expect(`${title.slice(0, -1)}${detail?.slice(1)}`.replace(/\s+/g, "")).toBe(body.replace(/\s+/g, ""));
  });

  it("never opens on a fragment of the word the title was cut in", () => {
    const body = "The verse runs long: the lamp and the water.";
    expect(taskDetail("The verse runs long: the lamp and t…", body)).toBe("…the water.");
    expect(taskDetail("The verse runs long: the lamp and…", body)).toBe("…the water.");
  });

  it("shows the whole body when it says something else", () => {
    expect(taskDetail("Fix the bridge", "The bridge modulates too early.")).toBe(
      "The bridge modulates too early.",
    );
    expect(taskDetail("", "Only a body")).toBe("Only a body");
  });

  it("doesn't take a title that ends inside the body's first word as repeated", () => {
    expect(taskDetail("Tempo", "Tempos need contrast")).toBe("Tempos need contrast");
    expect(taskDetail("Rewrite the bridge", "Rewrite the bridges tomorrow")).toBe("Rewrite the bridges tomorrow");
    expect(taskDetail("Rewrite the bridge", "Rewrite the bridge tomorrow")).toBe("tomorrow");
  });
});
