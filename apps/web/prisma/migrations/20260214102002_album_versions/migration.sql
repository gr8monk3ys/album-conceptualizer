-- CreateTable
CREATE TABLE "AlbumVersion" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "message" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumVersion_albumId_createdAt_idx" ON "AlbumVersion"("albumId", "createdAt");

-- AddForeignKey
ALTER TABLE "AlbumVersion" ADD CONSTRAINT "AlbumVersion_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumVersion" ADD CONSTRAINT "AlbumVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
