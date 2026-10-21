import { cache } from "react";

import { getPrisma } from "@/server/db";

/**
 * The user's active workspace. Deduplicated per request with React.cache: the
 * /app layout and the page under it both resolve it, which was two identical
 * queries per navigation and, for a brand-new user, two concurrent renders
 * racing to create the backstop workspace. Outside a server render (route
 * handlers) cache() is a pass-through.
 */
export const getActiveWorkspaceForUser = cache(async function getActiveWorkspaceForUser(
  userId: string,
) {
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
});

