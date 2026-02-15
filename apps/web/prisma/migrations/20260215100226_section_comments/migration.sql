-- CreateTable
CREATE TABLE "AlbumSectionComment" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "songTrackNumber" INTEGER NOT NULL,
    "sectionType" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AlbumSectionComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumSectionComment_albumId_sectionId_createdAt_idx" ON "AlbumSectionComment"("albumId", "sectionId", "createdAt");

-- CreateIndex
CREATE INDEX "AlbumSectionComment_authorUserId_createdAt_idx" ON "AlbumSectionComment"("authorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "AlbumSectionComment" ADD CONSTRAINT "AlbumSectionComment_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumSectionComment" ADD CONSTRAINT "AlbumSectionComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumSectionComment" ADD CONSTRAINT "AlbumSectionComment_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
