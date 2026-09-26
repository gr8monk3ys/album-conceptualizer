import { NextResponse } from "next/server";

import { getPrisma } from "@/server/db";
import { checkEngineHealth, isEngineConfigured } from "@/server/engine";
import { getProductionConfigIssues, isStrictProductionRuntime } from "@/server/production";
import { getRateLimitInitializationIssue } from "@/server/rate-limit";

export const runtime = "nodejs";

function serializeError(err: unknown) {
  if (!err) return "unknown_error";
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Public health check for uptime monitors and the smoke scripts: whether the app, its
 * configuration, the database and the engine are up, as booleans and "ok"/"degraded". It is
 * unauthenticated, so what went wrong (database errors, missing configuration) is logged for
 * operators, never answered.
 */
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

  if (!isEngineConfigured()) {
    // Optional dependency (useful for local development).
    checks.engine = true;
  } else {
    const engine = await checkEngineHealth();
    checks.engine = engine.ok;
    if (!engine.ok) errors.engine = engine.detail;
  }

  const ok = Object.values(checks).every(Boolean);
  if (Object.keys(errors).length) console.error("health_degraded", { checks, errors });
  return NextResponse.json(
    {
      ok,
      status: ok ? "ok" : "degraded",
      service: "album-conceptualizer-web",
      checks,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
