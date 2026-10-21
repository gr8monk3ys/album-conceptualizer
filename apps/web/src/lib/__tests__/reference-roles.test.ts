import { describe, expect, it } from "vitest";

import { REFERENCE_ROLES, referenceRoleLabel, referenceRoleList } from "@/lib/reference-roles";

describe("reference roles", () => {
  it("labels roles in sentence case", () => {
    expect(REFERENCE_ROLES.map(referenceRoleLabel)).toEqual([
      "Album world",
      "Opener",
      "Closer",
      "Chorus energy",
      "Vocal texture",
      "Mix palette",
      "Bridge contrast",
    ]);
  });

  it("lists roles inside a sentence in lower case", () => {
    expect(referenceRoleList(["opener", "closer", "vocal-texture", "mix-palette"])).toBe(
      "opener, closer, vocal texture and mix palette",
    );
    expect(referenceRoleList(["opener"])).toBe("opener");
    expect(referenceRoleList([])).toBe("");
  });
});
