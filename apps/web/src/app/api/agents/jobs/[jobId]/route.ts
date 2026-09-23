import { NextResponse } from "next/server";

import { apiHandler, requireUser } from "@/server/api";
import { readAgentJob } from "@/server/agent-jobs";

export const runtime = "nodejs";

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ jobId: string }> }) => {
    const userId = await requireUser();
    const { jobId } = await params;
    return NextResponse.json(await readAgentJob(jobId, userId));
  },
);
