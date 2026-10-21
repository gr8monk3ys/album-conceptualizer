import { afterEach, describe, expect, it, vi } from "vitest";

// The public health check with the database and configuration stubbed.
const state = vi.hoisted(() => ({ dbError: null as Error | null, configIssues: [] as string[] }));
vi.mock("@/server/db", () => ({
  getPrisma: () => ({
    $queryRaw: async () => {
      if (state.dbError) throw state.dbError;
      return [{ "?column?": 1 }];
    },
  }),
}));
vi.mock("@/server/production", () => ({
  getProductionConfigIssues: () => state.configIssues,
  isStrictProductionRuntime: () => false,
}));
vi.mock("@/server/rate-limit", () => ({ getRateLimitInitializationIssue: () => null }));

afterEach(() => {
  state.dbError = null;
  state.configIssues = [];
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("is ok when everything answers", async () => {
    vi.stubEnv("ENGINE_API_URL", "");
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "ok" });
  });

  it("says only that it is degraded, and logs the details for operators", async () => {
    vi.stubEnv("ENGINE_API_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    state.dbError = new Error('connect ECONNREFUSED db.internal:5432 password authentication failed for user "app"');
    state.configIssues = ["STRIPE_SECRET_KEY is missing."];

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ ok: false, status: "degraded", checks: { db: false, config: false } });
    expect(text).not.toMatch(/ECONNREFUSED|db\.internal|password|STRIPE_SECRET_KEY/);
    expect(JSON.stringify(log.mock.calls)).toMatch(/ECONNREFUSED/);
    expect(JSON.stringify(log.mock.calls)).toMatch(/STRIPE_SECRET_KEY/);
  });
});
