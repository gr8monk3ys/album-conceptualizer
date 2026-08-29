import { engineFetch } from "@/server/engine";


export type AgentJobStatus = "pending" | "running" | "completed" | "failed";

export type AgentJob = {
  job_id: string;
  status: AgentJobStatus;
  created_at: number;
  completed_at: number | null;
  result: { output: string } | null;
  error: string | null;
};

export type IdeationInput = {
  concept: string;
  references?: string;
  themes?: string;
  track_count?: number;
};

export type SongDevelopmentInput = {
  album_id: string;
  song_title: string;
  track_number: number;
  mood?: string;
  style_reference?: string;
  song_structure?: string;
};

export type CoherenceReviewInput = {
  album_id: string;
};

export type EngineError = {
  kind: "engine_error";
  status: number;
  detail: string;
};

function isEngineError(value: unknown): value is EngineError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "engine_error"
  );
}

async function postJson<T extends object>(
  path: string,
  body: T,
  ownerId?: string,
): Promise<AgentJob | EngineError> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ownerId) headers["x-owner-id"] = ownerId;
  const response = await engineFetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    return {
      kind: "engine_error",
      status: response.status,
      detail: await readErrorDetail(response),
    };
  }
  return (await response.json()) as AgentJob;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data?.detail === "string") return data.detail;
    return JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

export async function startIdeation(
  input: IdeationInput,
  ownerId?: string,
): Promise<AgentJob | EngineError> {
  return postJson(
    "/agents/ideation",
    {
      concept: input.concept,
      references: input.references ?? "",
      themes: input.themes ?? "",
      track_count: input.track_count ?? 10,
    },
    ownerId,
  );
}

export async function startSongDevelopment(
  input: SongDevelopmentInput,
  ownerId?: string,
): Promise<AgentJob | EngineError> {
  return postJson("/agents/song-development", input, ownerId);
}

export async function startCoherenceReview(
  input: CoherenceReviewInput,
  ownerId?: string,
): Promise<AgentJob | EngineError> {
  return postJson("/agents/coherence-review", input, ownerId);
}

export async function getAgentJob(
  jobId: string,
  ownerId?: string,
): Promise<AgentJob | EngineError> {
  const headers: Record<string, string> = {};
  if (ownerId) headers["x-owner-id"] = ownerId;
  const response = await engineFetch(`/agents/jobs/${encodeURIComponent(jobId)}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    return {
      kind: "engine_error",
      status: response.status,
      detail: await readErrorDetail(response),
    };
  }
  return (await response.json()) as AgentJob;
}

export { isEngineError };
