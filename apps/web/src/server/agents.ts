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

async function postJson<T extends object>(path: string, body: T): Promise<AgentJob | EngineError> {
  const response = await engineFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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

export async function startIdeation(input: IdeationInput): Promise<AgentJob | EngineError> {
  return postJson("/agents/ideation", {
    concept: input.concept,
    references: input.references ?? "",
    themes: input.themes ?? "",
    track_count: input.track_count ?? 10,
  });
}

export async function startSongDevelopment(
  input: SongDevelopmentInput,
): Promise<AgentJob | EngineError> {
  return postJson("/agents/song-development", input);
}

export async function startCoherenceReview(
  input: CoherenceReviewInput,
): Promise<AgentJob | EngineError> {
  return postJson("/agents/coherence-review", input);
}

export async function getAgentJob(jobId: string): Promise<AgentJob | EngineError> {
  const response = await engineFetch(`/agents/jobs/${encodeURIComponent(jobId)}`);
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
