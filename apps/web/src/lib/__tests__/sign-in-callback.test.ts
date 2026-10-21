import { describe, expect, it } from "vitest";

import { DEFAULT_CALLBACK_PATH, safeCallbackPath } from "@/lib/sign-in-callback";

const HERE = "http://127.0.0.1:3002";
const AUTH = "https://albums.example.com";
const origins = [HERE, AUTH];

describe("safeCallbackPath", () => {
  it("falls back to the app with no value", () => {
    expect(safeCallbackPath(null, origins)).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackPath(undefined, origins)).toBe("/app");
    expect(safeCallbackPath("", origins)).toBe("/app");
  });

  it("keeps a same-site path with its query and hash", () => {
    expect(safeCallbackPath("/app/library", origins)).toBe("/app/library");
    expect(safeCallbackPath("/app/search?q=tide#results", origins)).toBe(
      "/app/search?q=tide#results",
    );
    expect(safeCallbackPath("/share/abc123", [])).toBe("/share/abc123");
  });

  it("keeps the destination NextAuth rewrites to an absolute URL after a failed sign-in", () => {
    expect(safeCallbackPath("http://127.0.0.1:3002/app/library", origins)).toBe("/app/library");
    expect(safeCallbackPath(`${AUTH}/app/albums/a1/studio?song=3&focus=lyrics#x`, origins)).toBe(
      "/app/albums/a1/studio?song=3&focus=lyrics#x",
    );
    expect(safeCallbackPath("http://127.0.0.1:3002", origins)).toBe("/");
  });

  it("rejects absolute URLs on any other origin", () => {
    expect(safeCallbackPath("https://evil.example/app", origins)).toBe("/app");
    // Same host, other port or scheme: another origin.
    expect(safeCallbackPath("http://127.0.0.1:3003/app/library", origins)).toBe("/app");
    expect(safeCallbackPath("https://127.0.0.1:3002/app/library", origins)).toBe("/app");
    expect(safeCallbackPath("http://127.0.0.1:3002.evil.example/app", origins)).toBe("/app");
    expect(safeCallbackPath("http://127.0.0.1:3002@evil.example/app", origins)).toBe("/app");
    expect(safeCallbackPath("http://user:pw@127.0.0.1:3002/app", origins)).toBe("/app");
    // With no known origin, no absolute URL is trusted.
    expect(safeCallbackPath("http://127.0.0.1:3002/app/library", [])).toBe("/app");
    expect(safeCallbackPath("http://127.0.0.1:3002/app/library", [null, "not a url"])).toBe("/app");
  });

  it("rejects protocol-relative and scheme tricks", () => {
    expect(safeCallbackPath("//evil.example/app", origins)).toBe("/app");
    expect(safeCallbackPath("///evil.example", origins)).toBe("/app");
    expect(safeCallbackPath("javascript:alert(1)", origins)).toBe("/app");
    expect(safeCallbackPath("JavaScript:alert(1)//127.0.0.1:3002", origins)).toBe("/app");
    expect(safeCallbackPath("data:text/html,hi", origins)).toBe("/app");
    expect(safeCallbackPath("evil.example/app", origins)).toBe("/app");
    expect(safeCallbackPath("app/library", origins)).toBe("/app");
  });

  it("rejects backslash, whitespace and control-character tricks", () => {
    expect(safeCallbackPath("/\\evil.example", origins)).toBe("/app");
    expect(safeCallbackPath("\\\\evil.example", origins)).toBe("/app");
    expect(safeCallbackPath("/\t/evil.example", origins)).toBe("/app");
    expect(safeCallbackPath("/\n/evil.example", origins)).toBe("/app");
    expect(safeCallbackPath(" //evil.example", origins)).toBe("/app");
    expect(safeCallbackPath("http:\\\\evil.example", origins)).toBe("/app");
  });

  it("rejects a same-origin URL whose path would read as another host", () => {
    expect(safeCallbackPath("http://127.0.0.1:3002//evil.example/app", origins)).toBe("/app");
  });

  it("never sends a signed-in person back to the sign-in page", () => {
    expect(safeCallbackPath("/sign-in?error=CredentialsSignin", origins)).toBe("/app");
    expect(safeCallbackPath(`${HERE}/sign-in`, origins)).toBe("/app");
    expect(safeCallbackPath("/sign-in-help", origins)).toBe("/sign-in-help");
  });
});
