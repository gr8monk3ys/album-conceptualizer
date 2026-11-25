import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("next.config", () => {
  // Bundled by webpack, ws finds an empty stand-in for its optional `bufferutil` and calls
  // `bufferUtil.mask` on it for every frame of 48 bytes or more: "b.mask is not a function",
  // which dropped the Neon database socket in production. Loaded from node_modules, ws's
  // `require("bufferutil")` fails normally and it masks in JavaScript.
  it("leaves ws out of the server bundle", () => {
    expect(nextConfig.serverExternalPackages).toContain("ws");
  });
});
