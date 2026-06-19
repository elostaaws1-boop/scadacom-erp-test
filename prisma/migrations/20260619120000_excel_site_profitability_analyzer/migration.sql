-- Adaptive Excel Site Profitability Analyzer
CREATE TABLE "ExcelImportProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mappingRules" JSONB,
    "sectionRules" JSONB,
    "salaryRules" JSONB,
    "allowanceRules" JSONB,
    "categoryRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelImportProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExcelImportProfile_name_key" ON "ExcelImportProfile"("name");

ALTER TABLE "ExcelImport" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ExcelImport" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "ExcelImport" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "ExcelImportSheet" ADD COLUMN "detectedSections" JSONB;

CREATE TABLE "ExcelSiteCostRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "siteId" TEXT,
    "siteName" TEXT,
    "projectName" TEXT,
    "client" TEXT,
    "region" TEXT,
    "matchedProjectId" TEXT,
    "teamName" TEXT,
    "teamLeader" TEXT,
    "workDays" DECIMAL(10,2),
    "technicianCount" INTEGER,
    "fuelCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "highwayCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salaryAllocatedCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dailyAllowanceCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchaseCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "toolCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vehicleCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paperPrintingCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unknownCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2),
    "profitLoss" DECIMAL(14,2),
    "marginPercent" DECIMAL(8,2),
    "profitabilityStatus" TEXT NOT NULL DEFAULT 'REVENUE_MISSING',
    "rawData" JSONB NOT NULL,
    "mappedData" JSONB,
    "warnings" JSONB,
    "status" "ExcelImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "duplicateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelSiteCostRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExcelImportSummary" ADD COLUMN "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "ExcelImportSummary" ADD COLUMN "totalRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "ExcelImportSummary" ADD COLUMN "totalProfitLoss" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "ExcelImportSummary" ADD COLUMN "lossMakingSitesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExcelImportSummary" ADD COLUMN "profitableSitesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExcelImportSummary" ADD COLUMN "warningCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExcelImportSummary" ADD COLUMN "totalByTeam" JSONB;
ALTER TABLE "ExcelImportSummary" ADD COLUMN "lossMakingSites" JSONB;

CREATE INDEX "ExcelImport_profileId_idx" ON "ExcelImport"("profileId");
CREATE INDEX "ExcelImport_approvedById_idx" ON "ExcelImport"("approvedById");
CREATE INDEX "ExcelSiteCostRow_importId_status_idx" ON "ExcelSiteCostRow"("importId", "status");
CREATE INDEX "ExcelSiteCostRow_matchedProjectId_idx" ON "ExcelSiteCostRow"("matchedProjectId");
CREATE INDEX "ExcelSiteCostRow_siteId_idx" ON "ExcelSiteCostRow"("siteId");
CREATE INDEX "ExcelSiteCostRow_profitabilityStatus_idx" ON "ExcelSiteCostRow"("profitabilityStatus");
CREATE INDEX "ExcelSiteCostRow_duplicateKey_idx" ON "ExcelSiteCostRow"("duplicateKey");

ALTER TABLE "ExcelImport" ADD CONSTRAINT "ExcelImport_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ExcelImportProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExcelImport" ADD CONSTRAINT "ExcelImport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExcelSiteCostRow" ADD CONSTRAINT "ExcelSiteCostRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExcelImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExcelSiteCostRow" ADD CONSTRAINT "ExcelSiteCostRow_matchedProjectId_fkey" FOREIGN KEY ("matchedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
