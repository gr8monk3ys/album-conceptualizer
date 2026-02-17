import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token, platform } = await request.json();
  if (!token || !platform) {
    return NextResponse.json(
      { error: "token and platform are required" },
      { status: 400 },
    );
  }

  const prisma = getPrisma();

  const pushToken = await prisma.pushToken.upsert({
    where: { userId_token: { userId, token } },
    update: { platform, isActive: true, updatedAt: new Date() },
    create: { userId, token, platform },
  });

  return NextResponse.json(pushToken, { status: 201 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const prisma = getPrisma();

  await prisma.pushToken.updateMany({
    where: { userId, token },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
