"use client";

import { useCallback, useEffect, useRef, useState } from "react";


export type AgentJobStatus = "pending" | "running" | "completed" | "failed";

export type AgentJobSnapshot = {
  job_id: string;
  status: AgentJobStatus;
  created_at: number;
  completed_at: number | null;
  result: { output: string } | null;
  error: string | null;
};

type UseAgentJobOptions = {
  jobId: string | null;
  intervalMs?: number;
};

type UseAgentJobReturn = {
  job: AgentJobSnapshot | null;
  error: string | null;
  elapsedMs: number;
  isPolling: boolean;
};

const DEFAULT_INTERVAL_MS = 2000;

function isTerminal(status: AgentJobStatus): boolean {
  return status === "completed" || status === "failed";
}

export function useAgentJob({ jobId, intervalMs = DEFAULT_INTERVAL_MS }: UseAgentJobOptions): UseAgentJobReturn {
  const [job, setJob] = useState<AgentJobSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [trackedJobId, setTrackedJobId] = useState<string | null>(jobId);

  // Reset state synchronously when jobId changes (React "adjust state on prop change" pattern).
  if (trackedJobId !== jobId) {
    setTrackedJobId(jobId);
    setJob(null);
    setError(null);
    setElapsedMs(0);
  }

  // Use refs so the polling loop closure doesn't go stale.
  const cancelledRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  const fetchJob = useCallback(async (id: string): Promise<AgentJobSnapshot | null> => {
    const res = await fetch(`/api/agents/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const data = (await res.json()) as { error?: unknown };
        if (typeof data?.error === "string") detail = data.error;
      } catch {
        // swallow; use generic detail
      }
      throw new Error(detail);
    }
    return (await res.json()) as AgentJobSnapshot;
  }, []);

  useEffect(() => {
    if (!jobId) {
      startedAtRef.current = null;
      return;
    }

    cancelledRef.current = false;
    startedAtRef.current = Date.now();

    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelledRef.current) return;
      try {
        const snapshot = await fetchJob(jobId!);
        if (cancelledRef.current) return;
        setJob(snapshot);
        if (startedAtRef.current !== null) {
          setElapsedMs(Date.now() - startedAtRef.current);
        }
        if (snapshot && isTerminal(snapshot.status)) {
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        const message = err instanceof Error ? err.message : "Could not reach job endpoint.";
        setError(message);
        return;
      }
      timer = setTimeout(() => void tick(), intervalMs);
    }

    void tick();

    return () => {
      cancelledRef.current = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [jobId, intervalMs, fetchJob]);

  const isPolling =
    jobId !== null && error === null && (job === null || !isTerminal(job.status));

  return { job, error, elapsedMs, isPolling };
}
