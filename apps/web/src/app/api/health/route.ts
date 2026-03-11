import { NextResponse } from "next/server";

import { getPrisma } from "@/server/db";
import { engineFetch } from "@/server/engine";
import { getProductionConfigIssues, isStrictProductionRuntime } from "@/server/production";
import { getRateLimitInitializationIssue } from "@/server/rate-limit";

export const runtime = "nodejs";

function serializeError(err: unknown) {
  if (!err) return "unknown_error";
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function GET() {
  const checks: Record<string, boolean> = {
    api: true,
    config: true,
    db: false,
    engine: false,
  };
  const errors: Record<string, string> = {};

  const configIssues = getProductionConfigIssues();
  if (configIssues.length > 0) {
    checks.config = false;
    errors.config = configIssues.join(" ");
  }

  const rateLimitIssue = getRateLimitInitializationIssue();
  if (isStrictProductionRuntime() && rateLimitIssue) {
    checks.config = false;
    errors.config = [errors.config, `Upstash Redis initialization failed: ${rateLimitIssue}`]
      .filter(Boolean)
      .join(" ");
  }

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch (err) {
    errors.db = serializeError(err);
  }

  const engineConfigured = Boolean(process.env.ENGINE_API_URL);
  if (!engineConfigured) {
    // Optional dependency (useful for local development).
    checks.engine = true;
  } else {
    try {
      const res = await engineFetch("/health");
      checks.engine = res.ok;
      if (!res.ok) {
        errors.engine = (await res.text().catch(() => "")) || `Engine returned ${res.status}.`;
      }
    } catch (err) {
      errors.engine = serializeError(err);
    }
  }

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json(
    {
      ok,
      service: "album-conceptualizer-web",
      mode: isStrictProductionRuntime() ? "strict" : "default",
      checks,
      errors: Object.keys(errors).length ? errors : undefined,
    },
    { status: ok ? 200 : 503 },
  );
}
