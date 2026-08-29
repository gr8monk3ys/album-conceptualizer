ALTER TABLE "AnalyticsEvent"
ADD COLUMN "albumKey" TEXT;

UPDATE "AnalyticsEvent"
SET "albumKey" = "albumId"
WHERE "albumId" IS NOT NULL
  AND "albumKey" IS NULL;

CREATE INDEX "AnalyticsEvent_workspaceId_albumKey_event_createdAt_idx"
ON "AnalyticsEvent"("workspaceId", "albumKey", "event", "createdAt");
