import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { memberId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  // Only owner can remove members
  if (workspace.ownerId !== userId) {
    return NextResponse.json({ error: "Only workspace owner can remove members." }, { status: 403 });
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: workspace.id },
    select: { id: true, userId: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  // Can't remove yourself (the owner)
  if (member.userId === userId) {
    return NextResponse.json({ error: "Cannot remove workspace owner." }, { status: 400 });
  }

  await prisma.workspaceMember.delete({ where: { id: member.id } });
  return NextResponse.json({ ok: true });
}
