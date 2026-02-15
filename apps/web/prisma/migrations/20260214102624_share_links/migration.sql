-- CreateTable
CREATE TABLE "AlbumShareLink" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AlbumShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlbumShareLink_albumId_key" ON "AlbumShareLink"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumShareLink_token_key" ON "AlbumShareLink"("token");

-- CreateIndex
CREATE INDEX "AlbumShareLink_token_idx" ON "AlbumShareLink"("token");

-- AddForeignKey
ALTER TABLE "AlbumShareLink" ADD CONSTRAINT "AlbumShareLink_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumShareLink" ADD CONSTRAINT "AlbumShareLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
