-- CreateTable
CREATE TABLE "AlbumLyricsBaseline" (
    "albumId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "lyricHashes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumLyricsBaseline_pkey" PRIMARY KEY ("albumId","day")
);

-- CreateIndex
CREATE INDEX "AlbumLyricsBaseline_day_idx" ON "AlbumLyricsBaseline"("day");

-- AddForeignKey
ALTER TABLE "AlbumLyricsBaseline" ADD CONSTRAINT "AlbumLyricsBaseline_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
