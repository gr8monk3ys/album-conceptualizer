import { afterEach, describe, expect, it, vi } from "vitest";

import { checkEngineHealth, exportAlbumZip, getAgentJob, startAgentJob } from "@/server/engine";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("engine client", () => {
  it("sends the album snapshot, owner and api key to the agent endpoint", async () => {
    vi.stubEnv("ENGINE_API_URL", "http://engine.test/api/v1/");
    vi.stubEnv("ENGINE_API_KEY", "secret");
    const fetchMock = stubFetch(
      Response.json({ job_id: "j1", status: "pending", created_at: 1, completed_at: null, result: null, error: null }),
    );

    const job = await startAgentJob({ action: "coherence-review", album: { title: "A", songs: [] } }, "user-1");

    expect(job.job_id).toBe("j1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://engine.test/api/v1/agents/coherence-review");
    expect(JSON.parse(init.body as string)).toEqual({ album: { title: "A", songs: [] } });
    expect(init.headers).toMatchObject({ "x-owner-id": "user-1", "x-api-key": "secret" });
  });

  it("keeps engine 4xx statuses and their detail", async () => {
    stubFetch(Response.json({ detail: "Job not found" }, { status: 404 }));
    await expect(getAgentJob("missing", "user-1")).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining("Job not found"),
    });
  });

  it("never shows the artist a validation detail that isn't a sentence", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(
      Response.json(
        { detail: [{ type: "missing", loc: ["body", "album", "title"], msg: "Field required", input: null }] },
        { status: 422 },
      ),
    );
    const invalid = await exportAlbumZip({ album: null, formats: ["json"], includeProductionNotes: false }).catch(
      (err) => err,
    );
    expect(invalid.status).toBe(422);
    expect(invalid.message).toMatch(/^Export failed\. /);
    expect(invalid.message).not.toMatch(/[{}[\]]|missing|Field required/);

    stubFetch(Response.json({ detail: { code: "bad" } }, { status: 400 }));
    const object = await getAgentJob("j", "u").catch((err) => err);
    expect(object.message).not.toContain("code");

    stubFetch(new Response("<html><body>Bad Request</body></html>", { status: 400 }));
    const html = await getAgentJob("j", "u").catch((err) => err);
    expect(html.message).not.toContain("<html>");
  });

  it("maps engine 401 and 403 to 502, so the artist isn't told they are signed out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [401, 403]) {
      stubFetch(Response.json({ detail: "Invalid API key" }, { status }));
      const denied = await getAgentJob("j", "u").catch((err) => err);
      expect(denied.status).toBe(502);
      expect(denied.message).not.toContain("API key");
    }
  });

  it("passes the engine's retry-after through on 429", async () => {
    stubFetch(Response.json({ detail: "Too many active jobs" }, { status: 429, headers: { "retry-after": "30" } }));
    await expect(startAgentJob({ action: "ideation", concept: "x" }, "u")).rejects.toMatchObject({
      status: 429,
      headers: { "retry-after": "30" },
    });
  });

  it("maps engine 5xx and network failures to 502", async () => {
    stubFetch(new Response("boom", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getAgentJob("j", "u")).rejects.toMatchObject({ status: 502 });

    stubFetch(Response.json({ detail: "ANTHROPIC_API_KEY is not configured." }, { status: 503 }));
    const unavailable = await getAgentJob("j", "u").catch((err) => err);
    expect(unavailable.status).toBe(502);
    expect(unavailable.message).not.toContain("ANTHROPIC_API_KEY");
    expect(unavailable.message).toContain("isn't available");

    stubFetch(new TypeError("fetch failed"));
    await expect(getAgentJob("j", "u")).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("unreachable"),
    });
    expect(await checkEngineHealth()).toMatchObject({ ok: false });
  });
});

describe("getAgentAvailability", () => {
  it("is false when the engine can't be reached, and caches the answer", async () => {
    vi.resetModules();
    const { getAgentAvailability } = await import("@/server/engine");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = stubFetch(new TypeError("fetch failed"));
    expect(await getAgentAvailability()).toBe(false);
    expect(await getAgentAvailability()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads the engine's status", async () => {
    vi.resetModules();
    const { getAgentAvailability } = await import("@/server/engine");
    stubFetch(Response.json({ available: true }));
    expect(await getAgentAvailability()).toBe(true);
  });
});
