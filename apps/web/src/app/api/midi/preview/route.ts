import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { engineFetch } from "@/server/engine";
import { checkRateLimit, getRateLimitHeaders } from "@/server/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({
  chords: z.array(z.string().trim().min(1).max(32)).min(1).max(128),
  tempo: z.number().int().min(20).max(300).optional(),
  barsPerChord: z.number().int().min(1).max(8).optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rate = await checkRateLimit("preview_midi", `user:${userId}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many previews. Please wait a bit and try again." },
      { status: 429, headers: getRateLimitHeaders(rate) },
    );
  }

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const tempo = payload.data.tempo ?? 120;
  const barsPerChord = payload.data.barsPerChord ?? 1;

  const engineResponse = await engineFetch("/export/progression/midi", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/midi" },
    body: JSON.stringify({
      chords: payload.data.chords,
      tempo,
      bars_per_chord: barsPerChord,
      title: payload.data.title,
    }),
  });

  if (!engineResponse.ok) {
    const text = await engineResponse.text().catch(() => "");
    return NextResponse.json(
      { error: `Engine error (${engineResponse.status}): ${text || "request failed"}` },
      { status: 502 },
    );
  }

  const headers = new Headers(engineResponse.headers);
  headers.set("content-type", "audio/midi");
  headers.set("cache-control", "no-store");
  for (const [key, value] of Object.entries(getRateLimitHeaders(rate))) {
    headers.set(key, value);
  }

  return new Response(engineResponse.body, { status: 200, headers });
}

