import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrisma } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { engineFetch } from "@/server/engine";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";

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
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please wait a bit and try again." },
      { status: 429, headers: getRateLimitHeaders(rate) },
    );
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { title: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

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

  const filename = `${album.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "album"}_export.zip`;
  const headers = new Headers(engineResponse.headers);
  headers.set("content-type", "application/zip");
  headers.set("content-disposition", `attachment; filename="${filename}"`);

  return new Response(engineResponse.body, {
    status: 200,
    headers,
  });
}
