import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/collab/status
 *
 * Health-check endpoint for the real-time collaboration service.
 * The mobile app calls this before attempting a WebSocket connection so it
 * can skip the connection entirely and show a clear "unavailable" state
 * when the server is not yet ready.
 *
 * Once a WebSocket server is deployed, update the `status` field to
 * `"available"` (or add logic to probe the WS server health).
 */
export function GET() {
  return NextResponse.json(
    {
      status: "unavailable",
      message: "Real-time collaboration coming soon",
    },
    { status: 200 },
  );
}
