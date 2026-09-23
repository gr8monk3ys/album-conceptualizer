import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiHandler, parseJsonBody, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

const PatchBodySchema = z.object({
  action: z.enum(["read", "unread"]),
});

export const PATCH = apiHandler(
  async (request: Request, { params }: { params: Promise<{ notificationId: string }> }) => {
    const { userId, workspaceId } = await requireWorkspace();
    const payload = await parseJsonBody(request, PatchBodySchema, "Invalid payload.");
    const { notificationId } = await params;
    const prisma = getPrisma();

    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, workspaceId, userId },
      select: { id: true },
    });
    if (!existing) throw new ApiError(404, "Not found.");

    await prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: payload.action === "read" ? new Date() : null },
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  },
);
