-- AlterTable
ALTER TABLE "ChallengeCompletion" ADD COLUMN     "albumId" TEXT,
ADD COLUMN     "trackNumber" INTEGER;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
