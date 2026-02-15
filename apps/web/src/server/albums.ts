import { getPrisma } from "@/server/db";

export async function listAlbums(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.album.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      artist: true,
      conceptSummary: true,
      primaryGenre: true,
      trackCount: true,
      coverUrl: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function getAlbum(workspaceId: string, albumId: string) {
  const prisma = getPrisma();
  return prisma.album.findFirst({
    where: { id: albumId, workspaceId },
    select: {
      id: true,
      title: true,
      artist: true,
      conceptSummary: true,
      primaryGenre: true,
      centralThemes: true,
      trackCount: true,
      coverUrl: true,
      status: true,
      isPublic: true,
      publishedAt: true,
      data: true,
      updatedAt: true,
      createdAt: true,
    },
  });
}
