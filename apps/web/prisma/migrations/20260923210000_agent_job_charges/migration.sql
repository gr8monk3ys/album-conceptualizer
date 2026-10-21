-- CreateTable
CREATE TABLE "AgentJobCharge" (
    "jobId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "AgentJobCharge_pkey" PRIMARY KEY ("jobId")
);

-- CreateIndex
CREATE INDEX "AgentJobCharge_workspaceId_idx" ON "AgentJobCharge"("workspaceId");

-- AddForeignKey
ALTER TABLE "AgentJobCharge" ADD CONSTRAINT "AgentJobCharge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
