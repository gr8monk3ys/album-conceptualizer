import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/server/auth", () => ({ getAuthSession: vi.fn(async () => null) }));

import { ApiError, apiHandler, parseJsonBody, requireUser } from "@/server/api";

const request = (body?: string) =>
  new Request("http://test.local/api/thing", { method: "POST", body });

describe("apiHandler", () => {
  it("turns an ApiError into its status, headers and error body", async () => {
    const handler = apiHandler(async () => {
      throw new ApiError(429, "Slow down.", { "retry-after": "5" }, ["bucket: full"]);
    });
    const response = await handler(request(), {});
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(await response.json()).toEqual({ error: "Slow down.", details: ["bucket: full"] });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = apiHandler(async () => {
      throw new Error("database password is hunter2");
    });
    const response = await handler(request(), {});
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("hunter2");
    spy.mockRestore();
  });

  it("rejects signed-out callers with 401", async () => {
    const handler = apiHandler(async () => {
      await requireUser();
      return new Response("ok");
    });
    expect((await handler(request(), {})).status).toBe(401);
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ title: z.string().min(1), tracks: z.number().int() });

  it("returns parsed data", async () => {
    await expect(parseJsonBody(request('{"title":"A","tracks":3}'), schema)).resolves.toEqual({
      title: "A",
      tracks: 3,
    });
  });

  it("400s on malformed JSON", async () => {
    await expect(parseJsonBody(request("{nope"), schema)).rejects.toMatchObject({
      status: 400,
      message: "Request body must be JSON.",
    });
  });

  it("400s with per-field details on invalid data", async () => {
    const error = await parseJsonBody(request('{"title":"","tracks":1.5}'), schema, "Bad album.").catch(
      (err) => err,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("Bad album.");
    expect(error.details.join(" ")).toMatch(/title/);
    expect(error.details.join(" ")).toMatch(/tracks/);
  });
});
