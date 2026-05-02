-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "actionType" TEXT,
ADD COLUMN "module" TEXT,
ADD COLUMN "recordId" TEXT,
ADD COLUMN "recordLabel" TEXT,
ADD COLUMN "performedByName" TEXT,
ADD COLUMN "performedByRole" "Role",
ADD COLUMN "oldValue" JSONB,
ADD COLUMN "newValue" JSONB,
ADD COLUMN "changeSummary" TEXT,
ADD COLUMN "reason" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
ADD COLUMN "projectId" TEXT,
ADD COLUMN "financialAction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deletedRecord" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the legacy fields so old history appears in the new module.
UPDATE "AuditLog"
SET "actionType" = "action",
    "module" = "entity",
    "recordId" = "entityId",
    "oldValue" = "before",
    "newValue" = "after"
WHERE "actionType" IS NULL;

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_actionType_idx" ON "AuditLog"("module", "actionType");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_idx" ON "AuditLog"("projectId");
