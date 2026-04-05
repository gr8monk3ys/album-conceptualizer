import { NextResponse } from "next/server";

import { getAgentJob, isEngineError } from "@/server/agents";
import { getAuthSession } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { jobId } = await params;
  const result = await getAgentJob(jobId);
  if (isEngineError(result)) {
    const upstream = result.status === 404 ? 404 : 502;
    return NextResponse.json({ error: result.detail }, { status: upstream });
  }
  return NextResponse.json(result, { status: 200 });
}
