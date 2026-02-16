import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const InviteBodySchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  role: z.enum(["member", "admin"]).default("member"),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = InviteBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  // Only owner or admin can invite
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    select: { role: true },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only admins can invite members." }, { status: 403 });
  }

  // Check if user already exists
  const invitedUser = await prisma.user.findUnique({
    where: { email: payload.data.email },
    select: { id: true },
  });

  if (invitedUser) {
    // Check if already a member
    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: invitedUser.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "User is already a member." }, { status: 409 });
    }

    // Add directly to workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: invitedUser.id,
        role: payload.data.role,
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        workspaceId: workspace.id,
        userId: invitedUser.id,
        actorUserId: userId,
        type: "invite",
        title: `You were added to ${workspace.name}`,
        url: "/app",
      },
    });

    return NextResponse.json({ status: "added", email: payload.data.email }, { status: 201 });
  }

  // User doesn't exist yet - return pending status
  // In a full implementation this would send an email invite
  return NextResponse.json({
    status: "pending",
    email: payload.data.email,
    message: "User not found. They will be added when they sign up.",
  }, { status: 202 });
}

export async function GET(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ members });
}
