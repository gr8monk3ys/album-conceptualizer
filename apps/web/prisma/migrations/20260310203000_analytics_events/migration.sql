-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "albumId" TEXT,
    "sessionId" TEXT,
    "event" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'server',
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_workspaceId_event_createdAt_idx" ON "AnalyticsEvent"("workspaceId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_event_createdAt_idx" ON "AnalyticsEvent"("userId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_albumId_event_createdAt_idx" ON "AnalyticsEvent"("albumId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_event_createdAt_idx" ON "AnalyticsEvent"("sessionId", "event", "createdAt");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
