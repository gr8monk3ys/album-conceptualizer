import { afterEach, describe, expect, it, vi } from "vitest";

import { checkEngineHealth, getAgentJob, startAgentJob } from "@/server/engine";

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

  it("passes the engine's retry-after through on 429", async () => {
    stubFetch(Response.json({ detail: "Too many active jobs" }, { status: 429, headers: { "retry-after": "30" } }));
    await expect(startAgentJob({ action: "ideation", concept: "x" }, "u")).rejects.toMatchObject({
      status: 429,
      headers: { "retry-after": "30" },
    });
  });

  it("maps engine 5xx and network failures to 502", async () => {
    stubFetch(new Response("boom", { status: 500 }));
    await expect(getAgentJob("j", "u")).rejects.toMatchObject({ status: 502 });

    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(new TypeError("fetch failed"));
    await expect(getAgentJob("j", "u")).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("unavailable"),
    });
    expect(await checkEngineHealth()).toMatchObject({ ok: false });
  });
});
