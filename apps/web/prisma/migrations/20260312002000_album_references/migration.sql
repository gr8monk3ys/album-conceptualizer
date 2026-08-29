-- CreateTable
CREATE TABLE "AlbumReference" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "songId" TEXT,
    "songTrackNumber" INTEGER,
    "songTitle" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "targetRole" TEXT,
    "bpm" INTEGER,
    "key" TEXT,
    "moodTags" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "arrangementTags" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumReference_albumId_createdAt_idx" ON "AlbumReference"("albumId", "createdAt");

-- CreateIndex
CREATE INDEX "AlbumReference_albumId_songTrackNumber_createdAt_idx" ON "AlbumReference"("albumId", "songTrackNumber", "createdAt");

-- AddForeignKey
ALTER TABLE "AlbumReference" ADD CONSTRAINT "AlbumReference_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
