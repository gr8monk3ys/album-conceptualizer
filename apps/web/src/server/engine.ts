import { ApiError } from "@/server/api-error";

// The one client for the Python engine. Albums live in this app's database; every engine
// call that needs an album sends its snapshot (the album JSON), so the engine keeps no copy.
// Failures surface as ApiError: engine 4xx responses keep their status (and their detail when
// it is a sentence), everything else (401/403 from a wrong engine key, 5xx, timeouts, the
// engine being down) becomes a 502.

export type AgentAction = "ideation" | "song-development" | "coherence-review";
export type AgentJobStatus = "pending" | "running" | "completed" | "failed";

export type AgentJob = {
  job_id: string;
  status: AgentJobStatus;
  created_at: number;
  completed_at: number | null;
  result: { output: string } | null;
  error: string | null;
};

export type AgentInput =
  | {
      action: "ideation";
      concept: string;
      references?: string;
      themes?: string;
      track_count?: number;
    }
  | {
      action: "song-development";
      album: unknown;
      song_title: string;
      track_number: number;
      mood?: string;
      style_reference?: string;
      song_structure?: string;
    }
  | { action: "coherence-review"; album: unknown };

export type ProgressionInput = {
  chords: string[];
  tempo: number;
  barsPerChord: number;
  title?: string;
};

const PROGRESSION_FORMATS = {
  midi: { path: "/export/progression/midi", contentType: "audio/midi" },
  mp3: { path: "/export/progression/mp3", contentType: "audio/mpeg" },
} as const;

function engineBaseUrl() {
  return (process.env.ENGINE_API_URL ?? "http://localhost:8000/api/v1").replace(/\/+$/, "");
}

export function isEngineConfigured() {
  return Boolean(process.env.ENGINE_API_URL);
}

/**
 * The engine's error `detail` when it is a sentence written for people, else null. FastAPI's
 * validation details are lists of objects, and a proxy may answer with HTML: neither is shown.
 */
async function readDetail(response: Response): Promise<{ message: string | null; raw: string }> {
  const raw = (await response.text().catch(() => "")).trim().slice(0, 500);
  try {
    const data = JSON.parse(raw) as { detail?: unknown };
    if (typeof data?.detail === "string" && data.detail.trim()) return { message: data.detail.trim(), raw };
  } catch {
    // Not JSON: not for people.
  }
  return { message: null, raw };
}

async function call(
  path: string,
  init: {
    method?: "GET" | "POST";
    body?: unknown;
    accept?: string;
    ownerId?: string;
    timeoutMs: number;
    failure: string;
  },
): Promise<Response> {
  const headers: Record<string, string> = { accept: init.accept ?? "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.ownerId) headers["x-owner-id"] = init.ownerId;
  const apiKey = process.env.ENGINE_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;

  let response: Response;
  try {
    response = await fetch(`${engineBaseUrl()}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    console.error("engine_unreachable", { path, error: err instanceof Error ? err.message : err });
    throw new ApiError(502, `${init.failure} The service is unreachable right now; try again in a minute.`);
  }

  if (!response.ok) {
    const detail = await readDetail(response);
    const retryAfter = response.headers.get("retry-after");
    const headers = retryAfter ? { "retry-after": retryAfter } : undefined;
    // 401/403 mean this app's engine key is wrong: an operator problem, not the artist's
    // session, so they are a 502 below (a 401 would read as "you're signed out").
    if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403) {
      // Validation, not-found and rate-limit details are written for people; pass them on.
      // Anything else (a list of validation errors, HTML) gets a plain sentence instead.
      if (!detail.message) console.error("engine_rejected", { path, status: response.status, detail: detail.raw });
      const message = detail.message ?? "The request wasn't accepted. Check it and try again.";
      throw new ApiError(response.status, `${init.failure} ${message}`, headers);
    }
    // Server-side failures (including missing configuration) are for operators, not artists.
    console.error("engine_error", { path, status: response.status, detail: detail.raw });
    const message =
      response.status === 503
        ? `${init.failure} This feature isn't available on this server right now.`
        : `${init.failure} Something went wrong on our side; try again in a minute.`;
    throw new ApiError(502, message, headers);
  }
  return response;
}

export async function startAgentJob(input: AgentInput, ownerId: string): Promise<AgentJob> {
  const { action, ...body } = input;
  const response = await call(`/agents/${action}`, {
    body,
    ownerId,
    timeoutMs: 25_000,
    failure: "Could not start the agent.",
  });
  return (await response.json()) as AgentJob;
}

export async function getAgentJob(jobId: string, ownerId: string): Promise<AgentJob> {
  const response = await call(`/agents/jobs/${encodeURIComponent(jobId)}`, {
    ownerId,
    timeoutMs: 10_000,
    failure: "Could not load the agent job.",
  });
  return (await response.json()) as AgentJob;
}

/** A zip of the album in the requested formats, streamed from the engine. */
export async function exportAlbumZip(input: {
  album: unknown;
  formats: string[];
  includeProductionNotes: boolean;
}): Promise<ReadableStream<Uint8Array> | null> {
  const response = await call("/export/album/zip", {
    body: {
      album: input.album,
      formats: input.formats,
      include_production_notes: input.includeProductionNotes,
    },
    accept: "application/zip",
    timeoutMs: 60_000,
    failure: "Export failed.",
  });
  return response.body;
}

/** A chord progression rendered to MIDI or MP3, streamed from the engine. */
export async function renderProgression(
  format: keyof typeof PROGRESSION_FORMATS,
  input: ProgressionInput,
): Promise<{ body: ReadableStream<Uint8Array> | null; contentType: string }> {
  const target = PROGRESSION_FORMATS[format];
  const response = await call(target.path, {
    body: {
      chords: input.chords,
      tempo: input.tempo,
      bars_per_chord: input.barsPerChord,
      title: input.title,
    },
    accept: target.contentType,
    timeoutMs: 60_000,
    failure: "Preview render failed.",
  });
  return { body: response.body, contentType: target.contentType };
}

export async function checkEngineHealth(): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    await call("/health", { timeoutMs: 5_000, failure: "Engine health check failed." });
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

let agentAvailability: { value: boolean; expires: number } | null = null;

/**
 * Whether AI agent workflows can run right now (the engine has a model key and the agent
 * extra installed). Cached for a minute; an unreachable engine counts as unavailable, so AI
 * controls are disabled with an explanation instead of failing after a click.
 */
export async function getAgentAvailability(): Promise<boolean> {
  if (agentAvailability && agentAvailability.expires > Date.now()) return agentAvailability.value;
  let value = false;
  try {
    const response = await call("/agents/status", { timeoutMs: 3_000, failure: "Agent status check failed." });
    value = Boolean(((await response.json()) as { available?: unknown }).available);
  } catch {
    value = false;
  }
  agentAvailability = { value, expires: Date.now() + 60_000 };
  return value;
}
