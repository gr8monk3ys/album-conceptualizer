import { beforeEach, describe, expect, it, vi } from "vitest";

// The zip export route with the workspace, album, credits and engine stubbed.
const calls = vi.hoisted(() => ({ exported: [] as unknown[], charged: 0 }));
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: "user-1", workspaceId: "ws-1", plan: "free" }),
    requireAlbum: async () => ({ title: "Salt Year", data: { title: "Salt Year", songs: [] } }),
    enforceRateLimit: async () => ({}),
  };
});
vi.mock("@/server/credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/credits")>();
  return {
    ...actual,
    withCredits: async (_charge: unknown, work: () => Promise<unknown>) => {
      calls.charged += 1;
      return work();
    },
  };
});
vi.mock("@/server/engine", () => ({
  exportAlbumZip: async (input: unknown) => {
    calls.exported.push(input);
    return new Uint8Array([80, 75, 3, 4]);
  },
}));
vi.mock("@/server/analytics", () => ({ trackProductEventSafe: async () => undefined }));

const params = { params: Promise.resolve({ albumId: "album-1" }) };

function post(body: unknown) {
  return new Request("http://localhost/api/albums/album-1/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("album zip export route", () => {
  beforeEach(() => {
    calls.exported = [];
    calls.charged = 0;
  });

  it("spends credits only on a POST, never on a GET a link or redirect can make", async () => {
    const route = await import("@/app/api/albums/[albumId]/export/route");
    expect("GET" in route).toBe(false);
    expect(typeof route.POST).toBe("function");
  });

  it("builds the zip with the formats and notes choice in the body", async () => {
    const { POST } = await import("@/app/api/albums/[albumId]/export/route");
    const response = await POST(post({ formats: ["MIDI", "json"], includeProductionNotes: true }), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toMatch(/Salt_Year_export\.zip/);
    expect(calls.charged).toBe(1);
    expect(calls.exported).toEqual([
      { album: { title: "Salt Year", songs: [] }, formats: ["midi", "json"], includeProductionNotes: true },
    ]);
  });

  it("refuses an empty or unknown format list without charging", async () => {
    const { POST } = await import("@/app/api/albums/[albumId]/export/route");
    expect((await POST(post({ formats: [] }), params)).status).toBe(400);
    expect((await POST(post({ formats: ["wav"] }), params)).status).toBe(400);
    expect(calls.charged).toBe(0);
  });
});
