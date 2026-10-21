import { NextResponse } from "next/server";

import { apiHandler, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

export const POST = apiHandler(async () => {
  const { userId, workspaceId } = await requireWorkspace();

  await getPrisma().notification.updateMany({
    where: { workspaceId, userId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
