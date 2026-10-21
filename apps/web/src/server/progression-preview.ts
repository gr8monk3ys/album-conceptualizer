import { z } from "zod";

import { apiHandler, enforceRateLimit, parseJsonBody, requireUser } from "@/server/api";
import { renderProgression } from "@/server/engine";

const BodySchema = z.object({
  chords: z.array(z.string().trim().min(1).max(32)).min(1).max(128),
  tempo: z.number().int().min(20).max(300).optional(),
  barsPerChord: z.number().int().min(1).max(8).optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

/** A route handler that renders a posted chord progression as MIDI or MP3. */
export function progressionPreviewHandler(format: "midi" | "mp3") {
  const bucket = format === "midi" ? "preview_midi" : "preview_audio";
  const tooMany =
    format === "midi"
      ? "Too many previews. Please wait a bit and try again."
      : "Too many renders. Please wait a bit and try again.";

  return apiHandler(async (request: Request) => {
    const userId = await requireUser();
    const rateHeaders = await enforceRateLimit(bucket, `user:${userId}`, tooMany);
    const payload = await parseJsonBody(request, BodySchema);

    const rendered = await renderProgression(format, {
      chords: payload.chords,
      tempo: payload.tempo ?? 120,
      barsPerChord: payload.barsPerChord ?? 1,
      title: payload.title,
    });
    return new Response(rendered.body, {
      status: 200,
      headers: { ...rateHeaders, "content-type": rendered.contentType, "cache-control": "no-store" },
    });
  });
}
