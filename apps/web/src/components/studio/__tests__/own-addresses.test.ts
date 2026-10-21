import { describe, expect, it } from "vitest";

import { OwnAddresses, addressKey } from "@/components/studio/own-addresses";

describe("OwnAddresses", () => {
  it("treats props from an address the Studio wrote as an echo, not a link", () => {
    // Track 1, then track 2 (a title edit there, whose save refreshes), then track 3.
    const own = new OwnAddresses();
    own.wrote(addressKey("1", "s1"));
    own.wrote(addressKey("2", "s2"));
    own.wrote(addressKey("3", "s3"));
    // The refresh started on track 2 lands while track 3 is on screen.
    expect(own.isEcho({ song: "2", sid: "s2" })).toBe(true);
    // Asked again (React renders twice in development), the answer is the same.
    expect(own.isEcho({ song: "2", sid: "s2" })).toBe(true);
  });

  it("follows a link the Studio never wrote", () => {
    const own = new OwnAddresses();
    own.wrote(addressKey("1", "s1"));
    expect(own.isEcho({ song: "4", sid: "s9" })).toBe(false);
    expect(own.isEcho({ song: "1" })).toBe(false);
  });

  it("always follows a link that carries a focus or a section", () => {
    const own = new OwnAddresses();
    own.wrote(addressKey("2", "s2"));
    expect(own.isEcho({ song: "2", sid: "s2", focus: "story" })).toBe(false);
    expect(own.isEcho({ song: "2", section: "1" })).toBe(false);
  });

  it("forgets the addresses written before one the props echoed", () => {
    const own = new OwnAddresses();
    own.wrote(addressKey("1", "s1"));
    own.wrote(addressKey("2", "s2"));
    own.wrote(addressKey("3", "s3"));
    expect(own.isEcho({ song: "2", sid: "s2" })).toBe(true);
    // Props never go back past track 2 now: a link to track 1 is the writer's own.
    expect(own.isEcho({ song: "1", sid: "s1" })).toBe(false);
    expect(own.isEcho({ song: "3", sid: "s3" })).toBe(true);
  });

  it("keys a track with no sections by its number alone", () => {
    const own = new OwnAddresses();
    own.wrote(addressKey("5", null));
    expect(own.isEcho({ song: "5" })).toBe(true);
    expect(own.isEcho({ song: "5", sid: "" })).toBe(true);
  });
});
