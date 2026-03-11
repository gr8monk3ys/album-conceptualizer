import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrisma } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { engineFetch } from "@/server/engine";
import { checkRateLimit, getRateLimitFailure } from "@/server/rate-limit";
import { getCreditsStatus, InsufficientCreditsError, spendCredits } from "@/server/credits";
import { trackProductEventSafe } from "@/server/analytics";

export const runtime = "nodejs";

const FormatsSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(["midi", "chordpro", "musicxml", "json", "text"])))
  .refine((formats) => formats.length > 0, "Select at least one format.");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rate = await checkRateLimit("export_zip", `user:${userId}`);
  const rateFailure = getRateLimitFailure(rate, "Too many exports. Please wait a bit and try again.");
  if (rateFailure) {
    return NextResponse.json(rateFailure.body, {
      status: rateFailure.status,
      headers: rateFailure.headers,
    });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = workspace.subscription?.plan ?? "free";
  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { title: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const creditStatus = await getCreditsStatus({ workspaceId: workspace.id, plan });
  if (creditStatus.remaining < 2) {
    return NextResponse.json(
      { error: "Not enough credits to export. Complete challenges or upgrade." },
      { status: 402 },
    );
  }

  const url = new URL(request.url);
  const formatsRaw = url.searchParams.get("formats") ?? "json";
  const formatsParsed = FormatsSchema.safeParse(formatsRaw);
  if (!formatsParsed.success) {
    return NextResponse.json({ error: formatsParsed.error.issues[0]?.message ?? "Invalid formats." }, { status: 400 });
  }

  const includeProductionNotes = url.searchParams.get("production_notes") === "1";

  const engineResponse = await engineFetch("/export/album/zip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      album: album.data,
      formats: formatsParsed.data,
      include_production_notes: includeProductionNotes,
    }),
  });

  if (!engineResponse.ok) {
    const text = await engineResponse.text().catch(() => "");
    return NextResponse.json(
      { error: `Export engine error (${engineResponse.status}): ${text || "request failed"}` },
      { status: 502 },
    );
  }

  try {
    await spendCredits({
      workspaceId: workspace.id,
      plan,
      amount: 2,
      reason: "export_zip",
      metadata: { albumId, formats: formatsParsed.data },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits to export. Complete challenges or upgrade." },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : "Unable to spend credits.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const filename = `${album.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "album"}_export.zip`;
  const headers = new Headers(engineResponse.headers);
  headers.set("content-type", "application/zip");
  headers.set("content-disposition", `attachment; filename="${filename}"`);

  await trackProductEventSafe({
    name: "album_export_requested",
    workspaceId: workspace.id,
    userId,
    albumId,
    path: `/api/albums/${albumId}/export`,
    metadata: {
      formats: formatsParsed.data,
      includeProductionNotes,
    },
  });

  return new Response(engineResponse.body, {
    status: 200,
    headers,
  });
}
