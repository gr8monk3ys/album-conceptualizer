import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import { ApiError } from "@/server/api-error";
import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { effectivePlan, type Plan } from "@/server/plan";
import { checkRateLimit, getRateLimitHeaders, type LimiterName } from "@/server/rate-limit";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

// Route guards for API route handlers. Each guard either returns what the handler needs or
// throws an ApiError; `apiHandler` turns every thrown error into the one JSON error shape
// the client reads: `{ error: string, details?: string[] }`.

export { ApiError };

export function errorResponse(error: ApiError) {
  const body: { error: string; details?: string[] } = { error: error.message };
  if (error.details?.length) body.details = error.details;
  return NextResponse.json(body, { status: error.status, headers: error.headers });
}

export function apiHandler<Context>(
  handler: (request: Request, context: Context) => Promise<Response>,
): (request: Request, context: Context) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      console.error("api_unhandled_error", {
        method: request.method,
        path: new URL(request.url).pathname,
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      });
      return errorResponse(new ApiError(500, "Something went wrong. Please try again."));
    }
  };
}

export async function requireUser(): Promise<string> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "Unauthorized.");
  return userId;
}

export type WorkspaceContext = { userId: string; workspaceId: string; plan: Plan };

/** The signed-in user and the workspace they are acting in. */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const userId = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  return { userId, workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) };
}

/** An album in the caller's workspace, or a 404. */
export async function requireAlbum<Select extends Prisma.AlbumSelect>(
  workspaceId: string,
  albumId: string,
  select: Select,
): Promise<Prisma.AlbumGetPayload<{ select: Select }>> {
  const album = await getPrisma().album.findFirst({
    where: { id: albumId, workspaceId },
    select,
  });
  if (!album) throw new ApiError(404, "Not found.");
  return album as Prisma.AlbumGetPayload<{ select: Select }>;
}

function describeIssues(issues: z.core.$ZodIssue[]): string[] {
  return issues.slice(0, 5).map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/** Validate a value against a schema, or a 400 listing what is wrong. */
export function parseWith<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  message = "Invalid request.",
): z.infer<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, message, undefined, describeIssues(parsed.error.issues));
  }
  return parsed.data;
}

/** Parse and validate a JSON request body, or a 400. */
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  message = "Invalid request body.",
): Promise<z.infer<Schema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON.");
  }
  return parseWith(schema, body, message);
}

/**
 * Consume one request from a rate-limit bucket, or a 429 (503 when rate limiting is
 * required but unavailable). Returns the rate-limit headers to attach on success.
 */
export async function enforceRateLimit(
  name: LimiterName,
  key: string,
  message: string,
): Promise<Record<string, string>> {
  const rate = await checkRateLimit(name, key);
  if (rate.error) throw new ApiError(rate.status ?? 503, rate.error);
  const headers = getRateLimitHeaders(rate);
  if (!rate.ok) throw new ApiError(429, message, headers);
  return headers;
}
