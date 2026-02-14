import { getPrisma } from "@/server/db";

export async function getActiveWorkspaceForUser(userId: string) {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: { userId },
          },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { subscription: true },
  });

  if (workspace) return workspace;

  // Backstop: if the auth event failed (or user existed before we added it),
  // create a personal workspace now.
  return prisma.workspace.create({
    data: {
      name: "My Workspace",
      ownerId: userId,
      members: {
        create: {
          userId,
          role: "owner",
        },
      },
      subscription: {
        create: {
          plan: "free",
          status: "inactive",
        },
      },
    },
    include: { subscription: true },
  });
}

