import { getPrisma } from "@/server/db";

export async function getUnreadNotificationCount(opts: { workspaceId: string; userId: string }) {
  const prisma = getPrisma();
  return prisma.notification.count({
    where: {
      workspaceId: opts.workspaceId,
      userId: opts.userId,
      readAt: null,
    },
  });
}
