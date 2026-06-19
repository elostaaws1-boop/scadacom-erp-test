ALTER TABLE "Team"
ADD COLUMN "driverId" TEXT,
ADD COLUMN "vehicleId" TEXT,
ADD COLUMN "projectId" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN "notes" TEXT;

CREATE INDEX "Team_leaderId_idx" ON "Team"("leaderId");
CREATE INDEX "Team_driverId_idx" ON "Team"("driverId");
CREATE INDEX "Team_vehicleId_idx" ON "Team"("vehicleId");
CREATE INDEX "Team_projectId_idx" ON "Team"("projectId");
CREATE INDEX "Team_status_idx" ON "Team"("status");
